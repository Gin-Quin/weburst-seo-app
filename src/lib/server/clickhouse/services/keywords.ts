import { env } from "$env/dynamic/private";
import { getWeightedVolume } from "$lib/keywords/getWeightedVolume";
import { getSimilarity } from "$lib/numbers/getSimilarity";
import { db } from "$lib/server/db";
import { projects } from "$lib/server/db/schema";
import { normalizeUrlForSimilarity } from "$lib/strings/normalizeUrlForSimilarity";
import { DAY, MINUTE } from "$lib/timeUnits";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { KeywordAnalysisFrequency } from "../../../../routes/api/projects.schema";
import { getClickhouseClient } from "../index";
import type { ClickhouseTable } from "../migrations";
import { parseClickhouseCsvRows } from "../parseClickhouseCsvRow";
import type { DataForSeo } from "./DataForSeo";

const ANALYSIS_DEPTH = env.SEARCH_DEPTH;
const SIMILARITY_THRESHOLD = 0.6;

export type KeywordTuple = [name: string, volume: number];
export type Keyword = { name: string; volume: number };
export type KeywordSet = { setId: string; createdAt: string };

export type KeywordAnalysisInput = Omit<ClickhouseTable.KeywordAnalysis, "createdAt">;
export type KeywordAnalysisIdAndDate = Pick<ClickhouseTable.KeywordAnalysis, "id" | "createdAt">;

export type KeywordAnalysisStatus = {
	analysisId: string;
	totalTasks: number;
	completedTasks: number;
	failedTasks: number;
};

export type AggregatedKeywordAnalysis = {
	totalVolume: number;
	keywordCount: number;
	data: Array<ClickhouseTable.AggregatedKeywordAnalysisData>;
};

export type AggregatedKeywordAnalysisData = ClickhouseTable.AggregatedKeywordAnalysisData;

export type KeywordAnalysisTaskInput = Omit<ClickhouseTable.KeywordAnalysisTask, "createdAt">;

export type KeywordAnalysisResponseInput = Omit<
	ClickhouseTable.KeywordAnalysisResponse,
	"createdAt"
>;
export type KeywordAnalysisMinimalResponse = Pick<
	ClickhouseTable.KeywordAnalysisResponse,
	"keyword" | "domain" | "position"
>;

type AnalysisMetadata = Pick<ClickhouseTable.KeywordAnalysis, "projectId" | "setId">;

export type KeywordCluster = Array<KeywordClusterData>;

export type KeywordClusterData = {
	keyword: string;
	volume: number;
	items: Array<KeywordClusterItem>;
};

export type KeywordClusterItem = {
	domain: string;
	url: string;
	position: number;
};

export namespace KeywordsService {
	const analysisMetadata = new Map<string, AnalysisMetadata>();
	const keywordsBySetId = new Map<string, Map<string, number>>();
	const startedTasksCountCache: Record<string, number> = {};
	const completedTasksCountCache: Record<string, number> = {};
	const analysisCompletionCheckTimers: Record<string, ReturnType<typeof setTimeout>> = {};

	/**
	 * Return the total volume of a keyword set.
	 */
	function getTotalVolume(keywords: Map<string, number>): number {
		let totalVolume = 0;
		for (const volume of keywords.values()) {
			totalVolume += volume;
		}
		return totalVolume;
	}

	/**
	 * Check if analysis is complete.
	 */
	async function isAnalysisCompleted(analysisId: string): Promise<boolean> {
		const startedCount = await getStartedTasksCount(analysisId);
		const completedCount = await getCompletedTasksCount(analysisId);
		return startedCount > 0 && startedCount === completedCount;
	}

	/**
	 * Check if analysis is complete and trigger the next analysis if so.
	 * This function is debounced and should be called after each task completion.
	 */
	async function checkAnalysisCompletionAndTriggerNext({
		analysisId,
	}: {
		analysisId: string;
	}): Promise<void> {
		// Check if analysis is complete
		if (await isAnalysisCompleted(analysisId)) {
			console.log(`✅ Analysis ${analysisId} is complete`);

			await aggregateAnalysisResults({ analysisId });

			// When all is done, update status in keywordAnalysis table
			const clickhouse = getClickhouseClient();
			await clickhouse.command({
				query: `ALTER TABLE keywordAnalysis UPDATE status = 'completed' WHERE id = {analysisId: UUID}`,
				query_params: {
					analysisId,
				},
			});
		}
	}

	/**
	 * Debounced version of checkAnalysisCompletionAndTriggerNext.
	 * Waits 3 seconds after the last call before executing.
	 */
	function debouncedCheckAnalysisCompletion({ analysisId }: { analysisId: string }): void {
		// Clear any existing timer for this analysisId
		if (analysisCompletionCheckTimers[analysisId]) {
			clearTimeout(analysisCompletionCheckTimers[analysisId]);
		}

		// Set a new timer (3 seconds)
		analysisCompletionCheckTimers[analysisId] = setTimeout(() => {
			checkAnalysisCompletionAndTriggerNext({ analysisId })
				.catch((error) => {
					console.error(`Error checking analysis completion for ${analysisId}:`, error);
				})
				.finally(() => {
					// Clean up the timer reference
					delete analysisCompletionCheckTimers[analysisId];
				});
		}, 3000);
	}

	/**
	 * Add keywords to a project.
	 * @param projectId - The ID of the project.
	 * @param keywords - An array of keyword tuples.
	 */
	export async function addKeywords(
		projectId: string,
		keywords: Array<KeywordTuple>,
	): Promise<void> {
		const clickhouse = getClickhouseClient();
		const setId = crypto.randomUUID();

		const uniqueKeywords = keywords.filter(
			([name], index, self) => !self.slice(0, index).some(([otherName]) => otherName === name),
		);

		keywordsBySetId.set(setId, new Map(uniqueKeywords));

		await clickhouse.insert({
			table: "keywordSets",
			values: [{ id: setId, projectId }],
			format: "JSON",
		});

		await clickhouse.insert({
			table: "keywords",
			values: uniqueKeywords.map(([name, volume]) => ({ setId, name, volume })),
			format: "JSON",
		});
	}

	/**
	 * Get keyword sets for a given project.
	 */
	export async function getCurrentKeywordSet(projectId: string): Promise<string | undefined> {
		const clickhouse = getClickhouseClient();

		const response = await clickhouse.query({
			query: `
				SELECT id, createdAt
        FROM keywordSets
        WHERE projectId = {projectId:String}
        ORDER BY createdAt DESC
        LIMIT 1
      `,
			query_params: { projectId },
			format: "JSON",
		});
		const result = await response.json<KeywordAnalysisIdAndDate>();
		const currentSet = result.data[0];
		return currentSet?.id;
	}

	/**
	 * Get keywords for a given project and keyword set.
	 * If no keyword set is provided, the most recent one is used.
	 */
	export async function getKeywords(
		input: { projectId: string } | { setId: string },
	): Promise<Map<string, number> | null> {
		const clickhouse = getClickhouseClient();
		let setId: string;

		if ("setId" in input) {
			setId = input.setId;
		} else {
			const { projectId } = input;
			const response = await clickhouse.query({
				query: `
					SELECT id
          FROM keywordSets
          WHERE projectId = {projectId:String}
          ORDER BY createdAt DESC
          LIMIT 1
        `,
				query_params: { projectId },
				format: "JSON",
			});
			const result = await response.json<{ id: string }>();
			const latestSetId = result.data[0]?.id;
			if (!latestSetId) {
				return null;
			}
			setId = latestSetId;
		}

		console.log(`👀 Fetching keywords for set '${setId}'`);

		const cached = keywordsBySetId.get(setId);
		if (cached) {
			console.log(`✅ Cached keywords for set '${setId}'`);
			return cached;
		}

		const response = await clickhouse.query({
			query: `
				SELECT name, volume
        FROM keywords
        WHERE setId = {setId:UUID}
        ORDER BY volume DESC
			`,
			format: "CSV",
			query_params: { setId },
		});

		// Use ClickHouse client's built-in streaming for CSV
		const data = new Map<string, number>();
		const stream = response.stream();

		for await (const rows of stream) {
			const parsedRows = parseClickhouseCsvRows(rows, {
				name: "string",
				volume: "number",
			});
			for (const { name, volume } of parsedRows) {
				if (!data.has(name)) {
					data.set(name, volume);
				}
			}
		}

		console.log(`Fetched ${data.size} keywords`);
		keywordsBySetId.set(setId, data);
		return data;
	}

	/**
	 * Return the set ID of a given analysis.
	 */
	export async function getAnalysisMetadata({
		analysisId,
	}: {
		analysisId: string;
	}): Promise<AnalysisMetadata | null> {
		const cached = analysisMetadata.get(analysisId);
		if (cached) {
			return cached;
		}

		const clickhouse = getClickhouseClient();

		const response = await clickhouse.query({
			query: `
				SELECT projectId, setId
				FROM keywordAnalysis
				WHERE id = {analysisId: UUID}
				LIMIT 1
			`,
			query_params: { analysisId },
			format: "JSON",
		});

		const result = await response.json<{ projectId: string; setId: string }>();
		const data = result.data[0] ?? null;

		if (data) {
			analysisMetadata.set(analysisId, data);
		}

		return data;
	}

	/**
	 * Start keyword analysis for a project.
	 * @param projectId - The ID of the project.
	 */
	export async function startKeywordAnalysis(projectId: string, { priority = 2 } = {}) {
		const setId = await getCurrentKeywordSet(projectId);
		if (!setId) {
			throw new Error(`No keyword set found for project ${projectId}`);
		}

		const keywords = await getKeywords({ setId });
		if (!keywords?.size) {
			throw new Error(`No keywords found for set ${setId}`);
		}

		const analysisId = crypto.randomUUID();
		const callbackOptions = env.DATA_FOR_SEO_SERP_POSTBACK_URL
			? {
					postback_url: env.DATA_FOR_SEO_SERP_POSTBACK_URL,
					postback_data: "regular",
				}
			: {};

		// Initialize cache if it exists
		startedTasksCountCache[analysisId] = 0;
		completedTasksCountCache[analysisId] = 0;

		const url = `https://api.dataforseo.com/v3/serp/google/organic/task_post`;

		const chunks: Array<Array<[string, number]>> = [];
		const keywordEntries = Array.from(keywords.entries());
		for (let offset = 0; offset < keywords.size; offset += 100) {
			chunks.push(keywordEntries.slice(offset, offset + 100));
		}

		const clickhouse = getClickhouseClient();

		await clickhouse.insert<KeywordAnalysisInput>({
			table: "keywordAnalysis",
			values: [
				{
					id: analysisId,
					projectId,
					setId,
					status: "pending",
				},
			],
			format: "JSON",
		});

		await Promise.all(
			chunks.map(async (chunk) => {
				const body = chunk.map(([keyword]) => ({
					keyword,
					location_code: 2250,
					language_code: "fr",
					depth: ANALYSIS_DEPTH,
					priority,
					...callbackOptions,
				}));

				const response = await fetch(url, {
					method: "POST",
					headers: {
						Authorization: `Basic ${btoa(`${env.DATA_FOR_SEO_LOGIN}:${env.DATA_FOR_SEO_PASSWORD}`)}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(body),
				});

				if (!response.ok) {
					console.error(`Error starting keyword analysis: ${response.statusText}`);
					console.error(await response.json());
					throw new Error(`Error starting keyword analysis: ${response.statusText}`);
				}

				const result = (await response.json()) as DataForSeo.Serp.Response;

				if (result.status_code !== 20000) {
					console.error(`Error starting keyword analysis: ${result.status_message}`);
					return;
				}

				for (const task of result.tasks) {
					await clickhouse.insert<KeywordAnalysisTaskInput>({
						table: "keywordAnalysisTasks",
						values: [
							{
								id: task.id,
								analysisId: analysisId,
								status: "pending",
							},
						],
						format: "JSON",
					});

					// Increment cache if it exists
					if (startedTasksCountCache[analysisId] !== undefined) {
						startedTasksCountCache[analysisId]++;
					}

					if (task.status_code === 20100) {
						console.log(`🏗️  Task ${task.id} started successfully.`);
						if (!env.DATA_FOR_SEO_SERP_POSTBACK_URL) {
							setTimeout(() => pollKeywordAnalysisTask({ analysisId, taskId: task.id }), 1000);
						}
					} else {
						console.error(
							`⚠️ Task ${task.id} failed with status code ${task.status_code}: ${task.status_message}`,
						);
					}
				}
			}),
		);
	}

	/**
	 * Poll a keyword analysis task until it's completed.
	 * @param taskId - The ID of the task.
	 */
	export async function pollKeywordAnalysisTask({
		analysisId,
		taskId,
		retries = Infinity,
	}: {
		analysisId: string;
		taskId: string;
		retries?: number;
	}) {
		const url = `https://api.dataforseo.com/v3/serp/google/organic/task_get/regular/${taskId}`;
		let result: DataForSeo.Serp.Response;

		let tries = 0;

		do {
			if (tries >= retries) {
				console.error(`Max retries reached for task ${taskId}`);
				return;
			}
			tries++;

			await new Promise((resolve) => setTimeout(resolve, 1_000));
			const response = await fetch(url, {
				method: "GET",
				headers: {
					Authorization: `Basic ${btoa(`${env.DATA_FOR_SEO_LOGIN}:${env.DATA_FOR_SEO_PASSWORD}`)}`,
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				console.error(`Error polling keyword analysis task: ${response.statusText}`);
				console.error(await response.json());
				return;
			}

			result = await response.json();
		} while (result.tasks[0]?.status_code == 40601 || result.tasks[0]?.status_code == 40602);

		// Got the result, save it in database
		await saveKeywordAnalysisResult({ analysisId, result });
	}

	/**
	 * Save the result of a keyword analysis task in the database.
	 * @param taskId - The ID of the task.
	 * @param result - The result of the task.
	 */
	export async function saveKeywordAnalysisResult({
		analysisId,
		result,
	}: {
		analysisId: string;
		result: DataForSeo.Serp.Response;
	}) {
		const clickhouse = getClickhouseClient();

		for (const task of result.tasks) {
			if (task.status_code !== 20000) {
				console.warn(
					`Cannot save result for task ${task.id} with status code ${task.status_code}: ${task.status_message}`,
				);
				continue;
			}

			if (task.result == null) {
				console.warn(`No result data for task ${task.id}`);
				continue;
			}

			for (const { keyword, items } of task.result) {
				await clickhouse.insert<KeywordAnalysisResponseInput>({
					table: "keywordAnalysisResponses",
					values: items.map((item) => ({
						analysisId,
						taskId: task.id,
						keyword: keyword,
						position: item.rank_group,
						domain: item.domain,
						url: item.url,
						type: item.type,
						title: item.title,
						description: item.description,
					})),
					format: "JSON",
				});

				// Increment cache if it exists (one unique taskId per insert batch)
				if (completedTasksCountCache[analysisId] !== undefined) {
					completedTasksCountCache[analysisId]++;
				}

				console.log(`✨  Saved ${items.length} items for keyword '${keyword}'.`);
			}
		}

		// Trigger debounced check to see if analysis is complete
		debouncedCheckAnalysisCompletion({ analysisId });
	}

	/**
	 * Return the ID of the latest analysis for a project.
	 */
	export async function getProjectLastAnalysisId(projectId: string): Promise<string | null> {
		const clickhouse = getClickhouseClient();

		const response = await clickhouse.query({
			query: `
				SELECT id
				FROM keywordAnalysis
				WHERE projectId = {projectId: String}
				AND status = 'completed'
				ORDER BY createdAt DESC
				LIMIT 1
			`,
			query_params: { projectId },
			format: "JSON",
		});

		const result = await response.json<{ id: string }>();

		const analysisId = result.data[0]?.id;

		return analysisId || null;
	}

	/**
	 * Return all analysis ids with their date for one project.
	 */
	export async function getAllProjectAnalysis(
		projectId: string,
	): Promise<Array<KeywordAnalysisIdAndDate>> {
		console.log(`[getAllProjectAnalysis] 🚵‍♀️ Starting for project ${projectId}`);
		console.time(`[getAllProjectAnalysis] 🚵‍♂️ Total (${projectId})`);

		const clickhouse = getClickhouseClient();

		const response = await clickhouse.query({
			query: `
				SELECT id, createdAt
				FROM KeywordAnalysis
				WHERE projectId = {projectId: String}
				AND status = 'completed'
				ORDER BY createdAt DESC
			`,
			query_params: { projectId },
			format: "CSV",
		});

		let data: KeywordAnalysisIdAndDate[] = [];
		const stream = response.stream();

		for await (const rows of stream) {
			data = data.concat(
				parseClickhouseCsvRows(rows, {
					id: "string",
					createdAt: "string",
				}),
			);
		}

		console.timeEnd(`[getAllProjectAnalysis] 🚵‍♂️ Total (${projectId})`);
		return data;
	}

	/**
	 * Return the number of started and processed tasks for given analysis.
	 */
	export async function getAnalysisStatus(analysisId: string): Promise<KeywordAnalysisStatus> {
		return {
			analysisId,
			totalTasks: await getStartedTasksCount(analysisId),
			completedTasks: await getCompletedTasksCount(analysisId),
			failedTasks: 0,
		};
	}

	/**
	 * Returns the count of started tasks for a given analysis.
	 */
	export async function getStartedTasksCount(analysisId: string): Promise<number> {
		if (startedTasksCountCache[analysisId] !== undefined) {
			return startedTasksCountCache[analysisId];
		}

		const clickhouse = getClickhouseClient();

		const response = await clickhouse.query({
			query: `
				SELECT count() as total
				FROM keywordAnalysisTasks
				WHERE analysisId = {analysisId: String}
			`,
			query_params: { analysisId },
			format: "JSON",
		});

		const result = await response.json<{ total: string }>();

		const count = parseInt(result.data[0]?.total ?? "0", 10);

		// Store in cache
		startedTasksCountCache[analysisId] = count;

		return count;
	}

	/**
	 * Return the number of completed tasks for a given anaysis.
	 */
	export async function getCompletedTasksCount(analysisId: string): Promise<number> {
		// Check cache first
		if (completedTasksCountCache[analysisId] !== undefined) {
			return completedTasksCountCache[analysisId];
		}

		const clickhouse = getClickhouseClient();

		const response = await clickhouse.query({
			query: `
				SELECT count(DISTINCT taskId) as total
				FROM keywordAnalysisResponses
				WHERE analysisId = {analysisId: String}
			`,
			query_params: { analysisId },
			format: "JSON",
		});

		const result = await response.json<{ total: string }>();

		const count = parseInt(result.data[0]?.total ?? "0", 10);

		// Store in cache
		completedTasksCountCache[analysisId] = count;

		return count;
	}

	/**
	 * Return the keyword analysis responses for a given analysis.
	 */
	export async function getKeywordAnalysisResponses({
		analysisId,
		positionLimit,
		limit = 10000,
		offset = 0,
	}: {
		analysisId: string;
		positionLimit?: number;
		limit?: number;
		offset?: number;
	}): Promise<Array<KeywordAnalysisMinimalResponse>> {
		console.time(`[getKeywordAnalysisResponses] (${analysisId})`);
		const clickhouse = getClickhouseClient();

		const response = await clickhouse.query({
			query: `
				SELECT keyword, position, domain
				FROM keywordAnalysisResponses
				WHERE analysisId = {analysisId:String}
				${positionLimit ? `AND position <= ${positionLimit} ORDER BY position ASC` : ""}
				LIMIT {limit:UInt64} OFFSET {offset:UInt64}
			`,
			query_params: { analysisId, limit, offset },
			format: "CSV",
		});

		// Use ClickHouse client's built-in streaming for CSV
		let data: Array<KeywordAnalysisMinimalResponse> = [];
		const stream = response.stream();

		for await (const rows of stream) {
			data = data.concat(
				parseClickhouseCsvRows(rows, {
					keyword: "string",
					position: "number",
					domain: "string",
				}),
			);
		}

		console.timeEnd(`[getKeywordAnalysisResponses] (${analysisId})`);

		return data;
	}

	/**
	 * Returns the aggregated results for a given analysis.
	 */
	async function aggregateAnalysisResults({
		analysisId,
		positionLimit,
	}: {
		analysisId: string;
		positionLimit?: number;
	}): Promise<void> {
		if (await isAnalysisAggregationDone({ analysisId })) return;

		const analysis = await getAnalysisMetadata({ analysisId });
		if (!analysis) return;

		const { setId, projectId } = analysis;

		const keywords = await getKeywords({ setId });
		if (!keywords?.size) return;

		const lastMonth = await getLastMonthAggregatedAnalysis({
			projectId,
			limit: 100,
		});

		console.time(`🤓🤓 aggregateAnalysisResults getKeywordAnalysisResponses (${analysisId})`);
		const data = await getKeywordAnalysisResponses({ analysisId, positionLimit });
		console.timeEnd(`🤓🤓 aggregateAnalysisResults getKeywordAnalysisResponses (${analysisId})`);

		console.time(`🤓🤓 aggregateAnalysisResults Processing loop (${analysisId})`);
		const totalVolume = getTotalVolume(keywords);
		const distinctKeywords = new Set<string>();
		const distinctKeywordsByDomain = new Map<string, Map<string, number>>();
		const dataByDomain: Record<
			string,
			Omit<ClickhouseTable.AggregatedKeywordAnalysisData, "createdAt">
		> = {};

		for (const item of data) {
			let domainDistinctKeywords = distinctKeywordsByDomain.get(item.domain);
			if (!domainDistinctKeywords) {
				domainDistinctKeywords = new Map();
				distinctKeywordsByDomain.set(item.domain, domainDistinctKeywords);
			}

			const volume = keywords.get(item.keyword);
			if (!volume) {
				console.error(`Keyword ${item.keyword} not found in keywords`);
				continue;
			}

			const weightedVolume = getWeightedVolume(volume, item.position);

			if (!distinctKeywords.has(item.keyword)) {
				distinctKeywords.add(item.keyword);
			}

			const domainData = (dataByDomain[item.domain] ??= {
				analysisId,
				domain: item.domain,
				topThreeKeywordCount: 0,
				topTenKeywordCount: 0,
				positionnedKeywordCount: 0,
				volume: 0,
			});

			domainData.volume += weightedVolume;

			const previousPosition = domainDistinctKeywords.get(item.keyword);

			if (!previousPosition) {
				domainDistinctKeywords.set(item.keyword, item.position);
				domainData.positionnedKeywordCount += 1;
				if (item.position <= 3) {
					domainData.topThreeKeywordCount += 1;
				}
				if (item.position <= 10) {
					domainData.topTenKeywordCount += 1;
				}
			} else if (item.position < previousPosition) {
				domainDistinctKeywords.set(item.keyword, item.position);
				if (item.position <= 3 && previousPosition > 3) {
					domainData.topThreeKeywordCount += 1;
				}
				if (item.position <= 10 && previousPosition > 10) {
					domainData.topTenKeywordCount += 1;
				}
			}
		}
		console.timeEnd(`🤓🤓 aggregateAnalysisResults Processing loop (${analysisId})`);

		const valuesToInsert = Object.values(dataByDomain).sort((a, b) => b.volume - a.volume);

		if (lastMonth) {
			console.time(`🤓 aggregateAnalysisResults Adding trends (${analysisId})`);
			for (const valueToInsert of valuesToInsert) {
				const domain = valueToInsert.domain;
				const domainLastMonth = lastMonth.data.find((item) => item.domain === domain);
				if (domainLastMonth) {
					const currentVolumeShare = valueToInsert.volume / totalVolume;
					const lastMonthVolumeShare = domainLastMonth.volume / lastMonth.totalVolume;
					valueToInsert.trend = currentVolumeShare - lastMonthVolumeShare;
				}
			}
			console.timeEnd(`🤓 aggregateAnalysisResults Adding trends (${analysisId})`);
		}

		const clickhouse = getClickhouseClient();

		console.time(
			`🤓 aggregateAnalysisResults Inserting ${valuesToInsert.length} data (${analysisId})`,
		);
		await clickhouse.insert({
			table: "aggregatedKeywordAnalysisData",
			values: valuesToInsert,
			format: "JSON",
		});
		console.timeEnd(
			`🤓 aggregateAnalysisResults Inserting ${valuesToInsert.length} data (${analysisId})`,
		);
	}

	/**
	 * Check whether an analysis aggregation has already been done.
	 */
	async function isAnalysisAggregationDone({ analysisId }: { analysisId: string }) {
		const clickhouse = getClickhouseClient();

		const response = await clickhouse.query({
			query: `
				SELECT analysisId
				FROM aggregatedKeywordAnalysisData
				WHERE analysisId = {analysisId: UUID}
				LIMIT 1
			`,
			query_params: { analysisId },
			format: "JSON",
		});
		const result = await response.json<{ analysis: string }>();
		return result.data.length == 1;
	}

	/**
	 * Returns the last month analysis, i.e the most recent analysis that is at least 28 days before the most recent analysis.
	 * If only one analysis found, return undefined.
	 * If two or more analysis but less than one month ago, return the oldest analysis.
	 */
	export async function getLastMonthAnalysisId({
		projectId,
	}: {
		projectId: string;
	}): Promise<string | undefined> {
		const allAnalysis = await getAllProjectAnalysis(projectId);
		const mostRecentAnalysisAt = allAnalysis[0]?.createdAt;
		if (!mostRecentAnalysisAt) return undefined;
		const analysisOnemonthAgo = allAnalysis.find(
			(analysis) =>
				new Date(analysis.createdAt).getTime() <=
				new Date(mostRecentAnalysisAt).getTime() - 28 * DAY,
		);
		return (analysisOnemonthAgo ?? allAnalysis.at(-1))?.id;
	}

	/**
	 * Returns the last month aggregated analysis results.
	 */
	async function getLastMonthAggregatedAnalysis({
		projectId,
		domain,
		limit,
	}: {
		projectId: string;
		domain?: string;
		limit?: number;
	}): Promise<null | {
		totalVolume: number;
		data: Array<ClickhouseTable.AggregatedKeywordAnalysisData>;
	}> {
		const analysisId = await getLastMonthAnalysisId({ projectId });
		if (!analysisId) return null;

		const analysis = await getAnalysisMetadata({ analysisId });
		if (!analysis) return null;
		const { setId } = analysis;

		const keywords = await getKeywords({ setId });
		if (!keywords) return null;

		const totalVolume = getTotalVolume(keywords);

		const data = await getAggregatedAnalysisResults({
			analysisId,
			domain,
			limit,
		});

		return data ? { totalVolume, data } : null;
	}

	/**
	 *
	 */

	/**
	 * Get the latest aggregation for the given project.
	 */
	export async function getProjectLatestAggregatedAnalysisResults({
		projectId,
	}: {
		projectId: string;
	}): Promise<null | AggregatedKeywordAnalysis> {
		const analysisId = await getProjectLastAnalysisId(projectId);
		if (!analysisId) return null;

		const keywords = await getKeywords({ projectId });
		if (!keywords) return null;

		const totalVolume = getTotalVolume(keywords);

		const data = await getAggregatedAnalysisResults({
			analysisId,
			limit: 100,
		});
		if (!data) return null;

		return { keywordCount: keywords.size, totalVolume, data };
	}

	/**
	 * Return the given aggregated analysis results.
	 */
	export async function getAllAggregatedAnalysisResults({
		projectId,
		domain,
		limit,
	}: {
		projectId: string;
		domain?: string;
		limit?: number;
	}): Promise<
		Array<Pick<ClickhouseTable.AggregatedKeywordAnalysisData, "createdAt" | "domain" | "volume">>
	> {
		const clickhouse = getClickhouseClient();
		const allAnalysis = await getAllProjectAnalysis(projectId);
		const response = await clickhouse.query({
			query: `
				SELECT createdAt, domain, volume
				FROM aggregatedKeywordAnalysisData
				WHERE analysisIds IN {analysisId: Array(UUID)}
				${domain ? `AND domain = {domain: String}` : ""}
				${limit ? `LIMIT ${limit}` : ""}
			`,
			query_params: {
				analysisIds: allAnalysis.map((analysis) => analysis.id),
				domain,
			},
			format: "CSV",
		});

		let data: Array<
			Pick<ClickhouseTable.AggregatedKeywordAnalysisData, "createdAt" | "domain" | "volume">
		> = [];
		const stream = response.stream();

		for await (const rows of stream) {
			data = data.concat(
				parseClickhouseCsvRows(rows, {
					createdAt: "string",
					domain: "string",
					volume: "number",
				}),
			);
		}

		return data;
	}

	/**
	 * Return the given aggregated analysis results.
	 */
	export async function getAggregatedAnalysisResults({
		analysisId,
		domain,
		limit,
	}: {
		analysisId: string;
		domain?: string;
		limit?: number;
	}): Promise<null | Array<ClickhouseTable.AggregatedKeywordAnalysisData>> {
		const clickhouse = getClickhouseClient();
		const response = await clickhouse.query({
			query: `
				SELECT analysisId, createdAt, domain, volume, topThreeKeywordCount,
							 topTenKeywordCount, positionnedKeywordCount, trend
				FROM aggregatedKeywordAnalysisData
				WHERE analysisId = {analysisId: UUID}
				${domain ? `AND domain = {domain: String}` : ""}
				${limit ? `LIMIT ${limit}` : ""}
			`,
			query_params: { analysisId, domain },
			format: "CSV",
		});

		let data: ClickhouseTable.AggregatedKeywordAnalysisData[] = [];
		const stream = response.stream();

		for await (const rows of stream) {
			data = data.concat(
				parseClickhouseCsvRows(rows, {
					analysisId: "string",
					createdAt: "string",
					domain: "string",
					volume: "number",
					topThreeKeywordCount: "number",
					topTenKeywordCount: "number",
					positionnedKeywordCount: "number",
					trend: "number?",
				}),
			);
		}

		return data.length ? data : null;
	}

	/**
	 * Find similarities between keywords and group them by similar clusters.
	 */
	export async function getKeywordClusters({
		projectId,
	}: {
		projectId: string;
	}): Promise<null | Array<KeywordCluster>> {
		const analysisId = await getProjectLastAnalysisId(projectId);
		if (!analysisId) return null;

		const analysis = await getAnalysisMetadata({ analysisId });
		if (!analysis) return null;
		const { setId } = analysis;

		const keywords = await getKeywords({ setId });
		if (!keywords?.size) return null;

		console.log(`🏃‍♀️ getKeywordClusters ${projectId}`);
		console.time(`🏘️ getKeywordClusters ${projectId}`);
		const clickhouse = getClickhouseClient();

		console.time(`🏘️ getKeywordClusters ${projectId}: fetching CSV`);
		const response = await clickhouse.query({
			query: `
				SELECT keyword, domain, url, position
				FROM keywordAnalysisResponses
				WHERE analysisId = {analysisId: String}
				AND position <= 10 ORDER BY position ASC
			`,
			query_params: { analysisId },
			format: "CSV",
		});
		console.timeEnd(`🏘️ getKeywordClusters ${projectId}: fetching CSV`);

		const stream = response.stream();
		const dataByKeyword: Record<
			string,
			Array<Pick<ClickhouseTable.KeywordAnalysisResponse, "domain" | "url" | "position">>
		> = {};

		console.time(`🏘️ getKeywordClusters ${projectId}: parsing CSV`);
		for await (const rows of stream) {
			const parsedRows = parseClickhouseCsvRows(rows, {
				keyword: "string",
				domain: "string",
				url: "string",
				position: "number",
			});
			for (const { keyword, domain, url, position } of parsedRows) {
				const dataForKeyword = (dataByKeyword[keyword] ??= []);
				dataForKeyword.push({ domain, url, position });
			}
		}
		console.timeEnd(`🏘️ getKeywordClusters ${projectId}: parsing CSV`);

		const clusters: Array<KeywordCluster> = [];

		console.time(`🏘️ getKeywordClusters ${projectId}: aggregating results`);

		// Strategy 1: Pre-compute deduplicated items with normalized URLs
		type ItemWithNormalizedUrl = KeywordClusterItem & { normalizedUrl: string };
		const deduplicatedDataByKeyword = new Map<string, Array<ItemWithNormalizedUrl>>();
		const normalizedUrlSetsByKeyword = new Map<string, Set<string>>();

		for (const keyword in dataByKeyword) {
			const items = dataByKeyword[keyword]!;
			const seenUrls = new Set<string>();
			const deduplicatedItems: Array<ItemWithNormalizedUrl> = [];
			const normalizedUrls = new Set<string>();

			for (const item of items) {
				if (!seenUrls.has(item.url)) {
					seenUrls.add(item.url);
					const normalizedUrl = normalizeUrlForSimilarity(item.url);
					deduplicatedItems.push({ ...item, normalizedUrl });
					normalizedUrls.add(normalizedUrl);
				}
			}

			deduplicatedDataByKeyword.set(keyword, deduplicatedItems);
			normalizedUrlSetsByKeyword.set(keyword, normalizedUrls);
		}

		// Strategy 2: Use Set to track clustered keywords for O(1) lookup
		const clusteredKeywords = new Set<string>();

		for (const keyword in dataByKeyword) {
			if (clusteredKeywords.has(keyword)) {
				continue;
			}

			const items = deduplicatedDataByKeyword.get(keyword)!;
			const normalizedUrlSet = normalizedUrlSetsByKeyword.get(keyword)!;

			const cluster: KeywordCluster = [
				{
					keyword,
					items,
					volume: keywords.get(keyword) ?? 0,
				},
			];

			clusteredKeywords.add(keyword);

			for (const otherKeyword in dataByKeyword) {
				if (keyword === otherKeyword || clusteredKeywords.has(otherKeyword)) {
					continue;
				}

				const otherItems = deduplicatedDataByKeyword.get(otherKeyword)!;
				const otherNormalizedUrlSet = normalizedUrlSetsByKeyword.get(otherKeyword)!;

				// Strategy 3: Use pre-computed normalized URL sets for similarity
				const similarity = getSimilarity(normalizedUrlSet, otherNormalizedUrlSet);

				if (similarity >= SIMILARITY_THRESHOLD) {
					// Build set of URLs already in cluster for efficient filtering
					const urlsInCluster = new Set<string>();
					for (const clusterItem of cluster) {
						for (const item of clusterItem.items) {
							urlsInCluster.add(item.url);
						}
					}

					cluster.push({
						keyword: otherKeyword,
						items: otherItems.filter((item) => !urlsInCluster.has(item.url)),
						volume: keywords.get(otherKeyword) ?? 0,
					});

					clusteredKeywords.add(otherKeyword);
				}
			}

			cluster.sort((a, b) => b.volume - a.volume);
			clusters.push(cluster);
		}
		console.timeEnd(`🏘️ getKeywordClusters ${projectId}: aggregating results`);

		console.timeEnd(`🏘️ getKeywordClusters ${projectId}`);

		return clusters;
	}

	/**
	 * Check every project if it needs to be analyzed again.
	 *
	 */
	export async function startAllKeywordAnalysis() {
		console.log("⏰ Starting daily keyword analysis");

		const frequencies: Array<KeywordAnalysisFrequency> = ["1/day"];
		const date = new Date().getDate();

		if (date == 1) frequencies.push("1/month", "1/week", "2/month");
		if (date == 7) frequencies.push("1/week");
		if (date == 15) frequencies.push("1/week", "2/month");
		if (date == 22) frequencies.push("1/week");

		console.log(`Checking projects with frequencies: ${frequencies.join(", ")}`);

		const auditProjects = await db.query.projects.findMany({
			where: and(
				eq(projects.type, "audit"),
				inArray(projects.keywordAnalysisFrequency, frequencies),
				isNull(projects.deletedAt),
			),
		});

		console.log(`Found ${auditProjects.length} projects to audit.`);

		for (const project of auditProjects) {
			await startKeywordAnalysis(project.id, { priority: 1 })
				.then(() => {
					console.log(`Started analysis for project ${project.id}`);
				})
				.catch((error) => {
					console.error(`Error starting analysis for project ${project.id}: ${error}`);
				});

			await new Promise((resolve) => setTimeout(resolve, 2 * MINUTE));
		}
	}

	/**
	 * Fetch the ready tasks.
	 */
	export async function fetchTasksReady() {
		console.log("⏰ Fetching tasks ready");

		const url = `https://api.dataforseo.com/v3/serp/google/organic/tasks_ready`;

		try {
			const response = await fetch(url, {
				method: "GET",
				headers: {
					Authorization: `Basic ${btoa(`${env.DATA_FOR_SEO_LOGIN}:${env.DATA_FOR_SEO_PASSWORD}`)}`,
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				console.error(`Error starting keyword analysis: ${response.statusText}`);
				console.error(await response.json());
				throw new Error(`Error starting keyword analysis: ${response.statusText}`);
			}

			const result = (await response.json()) as DataForSeo.Serp.TaskReadyResponse;

			for (const task of result.tasks) {
				const analysisId = await getAnalysisIdFromTaskId({ taskId: task.id });
				if (!analysisId) {
					console.warn(`No analysis ID found for task ${task.id}`);
					continue;
				}
				await pollKeywordAnalysisTask({
					analysisId,
					taskId: task.id,
					retries: 1,
				});
			}
		} catch (error) {
			console.error(`Error fetching tasks ready: ${error}`);
		}
	}

	/**
	 * Get analysis if from a task id.
	 */
	export async function getAnalysisIdFromTaskId({
		taskId,
	}: {
		taskId: string;
	}): Promise<string | null> {
		const clickhouse = getClickhouseClient();
		const response = await clickhouse.query({
			query: `SELECT analysisId FROM keywordAnalysisTasks WHERE id = {taskId:UUID}`,
			query_params: { taskId },
		});
		const result = await response.json<Pick<ClickhouseTable.KeywordAnalysisTask, "analysisId">>();
		return result.data[0]?.analysisId ?? null;
	}

	/**
	 * Get all past analysis for one project.
	 */
	// export async function get
}
