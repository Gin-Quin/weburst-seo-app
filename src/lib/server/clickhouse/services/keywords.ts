// import { env } from "$env/dynamic/private";
import { env } from "$env/dynamic/private";
import { getWeightedVolume } from "$lib/keywords/getWeightedVolume";
import { DAY } from "$lib/timeUnits";
import { getClickhouseClient } from "../index";
import type { DataForSeo } from "./DataForSeo";

export type KeywordTuple = [name: string, volume: number];
export type Keyword = { name: string; volume: number };
export type KeywordSet = { setId: string; createdAt: string };

export type KeywordAnalysis = {
	id: string;
	createdAt: string;
	status: "pending" | "completed" | "failed";
	projectId: string;
	setId: string;
	error?: string;
};
export type KeywordAnalysisInput = Omit<KeywordAnalysis, "createdAt">;
export type KeywordAnalysisIdAndDate = Pick<KeywordAnalysis, "id" | "createdAt">;

export type KeywordAnalysisStatus = {
	analysisId: string;
	totalTasks: number;
	completedTasks: number;
	failedTasks: number;
};

export type KeywordAnalysisTask = {
	id: string;
	createdAt: string;
	analysisId: string;
	status: "pending" | "completed" | "failed";
	error?: string;
};
export type KeywordAnalysisTaskInput = Omit<KeywordAnalysisTask, "createdAt">;

export type KeywordAnalysisResponse = {
	projectId: string;
	analysisId: string;
	taskId: string;
	createdAt: string;
	keyword: string;
	position: number;
	domain: string;
	url: string;
	type: string;
	title: string;
	description: string;
};
export type KeywordAnalysisResponseInput = Omit<KeywordAnalysisResponse, "createdAt">;

export type AggregatedKeywordAnalysis = {
	analysisId: string;
	setId: string;
	totalVolume: number;
	keywordCount: number;
	data: Array<AggregatedKeywordAnalysisData>;
};

export type AggregatedKeywordAnalysisData = {
	domain: string;
	volume: number;
	topThreeKeywordCount: number;
	topTenKeywordCount: number;
	trend?: number;
};

export namespace KeywordsService {
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

		await clickhouse.insert({
			table: "keywordSets",
			values: [{ id: setId, projectId }],
			format: "JSON",
		});

		await clickhouse.insert({
			table: "keywords",
			values: keywords.map(([name, volume]) => ({ setId, name, volume })),
			format: "JSON",
		});
	}

	/**
	 * Get keyword sets for a given project.
	 */
	export async function getKeywordSets(projectId: string): Promise<Array<KeywordSet>> {
		const clickhouse = getClickhouseClient();

		const response = await clickhouse.query({
			query: `
				SELECT id, createdAt
        FROM keywordSets
        WHERE projectId = {projectId:String}
        ORDER BY createdAt DESC
      `,
			query_params: { projectId },
			format: "JSON",
		});
		const result = await response.json<KeywordAnalysisIdAndDate>();
		return result.data.map(({ id, createdAt }) => ({ setId: id, createdAt }));
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
	): Promise<Keyword[]> {
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
				throw new Error(`No keyword set found for project ${projectId}`);
			}
			setId = latestSetId;
		}

		console.log(`👀 Fetching keywords for set '${setId}'`);

		const response = await clickhouse.query({
			query: `
				SELECT name, volume
        FROM keywords
        WHERE setId = {setId:String}
        ORDER BY volume DESC
			`,
			format: "JSON",
			query_params: { setId },
		});
		const result = await response.json<Keyword>();

		console.log(`Fetched ${result.data.length} keywords`);

		return result.data;
	}

	/**
	 * Return the set ID of a given analysis.
	 */
	export async function getSetIdOfAnalysis({
		analysisId,
	}: {
		analysisId: string;
	}): Promise<string | null> {
		const clickhouse = getClickhouseClient();

		const response = await clickhouse.query({
			query: `
				SELECT setId
				FROM keywordAnalysis
				WHERE id = {analysisId: String}
			`,
			query_params: { analysisId },
			format: "JSON",
		});

		const result = await response.json<{ setId: string }>();
		return result.data[0]?.setId ?? null;
	}

	/**
	 * Start keyword analysis for a project.
	 * @param projectId - The ID of the project.
	 */
	export async function startKeywordAnalysis(projectId: string) {
		const setId = await getCurrentKeywordSet(projectId);
		if (!setId) {
			throw new Error(`No keyword set found for project ${projectId}`);
		}

		const keywords = await getKeywords({ setId });
		if (!keywords.length) {
			throw new Error(`No keywords found for set ${setId}`);
		}

		const analysisId = crypto.randomUUID();
		const callbackOptions = env.DATA_FOR_SEO_SERP_POSTBACK_URL
			? {
					postback_url: env.DATA_FOR_SEO_SERP_POSTBACK_URL,
					postback_data: "regular",
				}
			: {};

		const url = `https://api.dataforseo.com/v3/serp/google/organic/task_post`;
		const response = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Basic ${btoa(`${env.DATA_FOR_SEO_LOGIN}:${env.DATA_FOR_SEO_PASSWORD}`)}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(
				keywords.map((keyword) => ({
					keyword: keyword.name,
					location_code: 2250,
					language_code: "fr",
					depth: 22,
					priority: 2,
					...callbackOptions,
				})),
			),
		});

		if (!response.ok) {
			console.error(`Error starting keyword analysis: ${response.statusText}`);
			console.error(await response.json());
			throw new Error(`Error starting keyword analysis: ${response.statusText}`);
		}

		const result = (await response.json()) as DataForSeo.Serp.Response;

		console.dir(result, { depth: null });

		if (result.status_code !== 20000) {
			console.error(`Error starting keyword analysis: ${result.status_message}`);
			return;
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

			if (task.status_code === 20100) {
				console.log(`🏗️  Task ${task.id} started successfully.`);
				if (!env.DATA_FOR_SEO_SERP_POSTBACK_URL) {
					void pollKeywordAnalysisTask({ projectId, analysisId, taskId: task.id });
				}
			} else {
				console.error(
					`⚠️ Task ${task.id} failed with status code ${task.status_code}: ${task.status_message}`,
				);
			}
		}
	}

	/**
	 * Poll a keyword analysis task until it's completed.
	 * @param taskId - The ID of the task.
	 */
	export async function pollKeywordAnalysisTask({
		projectId,
		analysisId,
		taskId,
	}: {
		projectId: string;
		analysisId: string;
		taskId: string;
	}) {
		const url = `https://api.dataforseo.com/v3/serp/google/organic/task_get/regular/${taskId}`;
		let result: DataForSeo.Serp.Response;

		do {
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
		await saveKeywordAnalysisResult({ projectId, analysisId, taskId, result });
	}

	/**
	 * Save the result of a keyword analysis task in the database.
	 * @param taskId - The ID of the task.
	 * @param result - The result of the task.
	 */
	export async function saveKeywordAnalysisResult({
		projectId,
		analysisId,
		taskId,
		result,
	}: {
		projectId: string;
		analysisId: string;
		taskId: string;
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

			for (const result of task.result) {
				await clickhouse.insert<KeywordAnalysisResponseInput>({
					table: "keywordAnalysisResponses",
					values: result.items.map((item) => ({
						projectId,
						analysisId,
						taskId,
						keyword: result.keyword,
						position: item.rank_group,
						domain: item.domain,
						url: item.url,
						type: item.type,
						title: item.title,
						description: item.description,
					})),
					format: "JSON",
				});

				console.log(`✨  Saved ${result.items.length} items for keyword '${result.keyword}'.`);
			}
		}
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
		const clickhouse = getClickhouseClient();

		const response = await clickhouse.query({
			query: `
				SELECT id, createdAt
				FROM keywordAnalysis
				WHERE projectId = {projectId: String}
				ORDER BY createdAt DESC
			`,
			query_params: { projectId },
			format: "JSON",
		});

		const result = await response.json<KeywordAnalysisIdAndDate>();
		return result.data;
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

		return parseInt(result.data[0]?.total ?? "0", 10);
	}

	/**
	 * Return the number of completed tasks for a given anaysis.
	 */
	export async function getCompletedTasksCount(analysisId: string): Promise<number> {
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

		return parseInt(result.data[0]?.total ?? "0", 10);
	}

	/**
	 * Returns the aggregated results for a given analysis.
	 */
	export async function aggregateAnalysisResults({
		analysisId,
	}: {
		analysisId: string;
	}): Promise<AggregatedKeywordAnalysis | null> {
		const clickhouse = getClickhouseClient();

		const setId = await getSetIdOfAnalysis({ analysisId });
		if (!setId) return null;

		const keywords = await getKeywords({ setId });

		const response = await clickhouse.query({
			query: `
				SELECT keyword, position, domain
				FROM keywordAnalysisResponses
				WHERE analysisId = {analysisId: String}
			`,
			query_params: { analysisId },
			format: "JSON",
		});

		const { data } = await response.json<{ keyword: string; position: number; domain: string }>();

		let totalVolume = 0;
		const distinctKeywords = new Set<string>();
		const dataByDomain: Record<string, AggregatedKeywordAnalysisData> = {};

		for (const item of data) {
			const volume = keywords.find(({ name }) => name == item.keyword)?.volume;
			if (!volume) {
				console.error(`Keyword ${item.keyword} not found in keywords`);
				continue;
			}

			const weightedVolume = getWeightedVolume(volume, item.position);
			if (!distinctKeywords.has(item.keyword)) {
				distinctKeywords.add(item.keyword);
				totalVolume += volume;
			}

			dataByDomain[item.domain] ??= {
				domain: item.domain,
				topThreeKeywordCount: 0,
				topTenKeywordCount: 0,
				volume: 0,
			};
			if (item.position <= 3) {
				dataByDomain[item.domain]!.topThreeKeywordCount += 1;
			}
			if (item.position <= 10) {
				dataByDomain[item.domain]!.topTenKeywordCount += 1;
			}
			dataByDomain[item.domain]!.volume += weightedVolume;
		}

		return {
			analysisId,
			setId,
			totalVolume,
			keywordCount: distinctKeywords.size,
			data: Object.values(dataByDomain).sort((a, b) => b.volume - a.volume),
		};
	}

	/**
	 * Returns the aggregated results with the trend comparing to last month.
	 */
	export async function aggregateAnalysisResultsWithTrend({
		projectId,
	}: {
		projectId: string;
	}): Promise<AggregatedKeywordAnalysis | null> {
		const allAnalysis = await getAllProjectAnalysis(projectId);
		const currentAnalysisId = allAnalysis[0]?.id;
		if (!currentAnalysisId) {
			return null;
		}

		const lastMonthAnalysisId = getLastMonthAnalysisId({ allAnalysis });

		const currentAnalysis = await aggregateAnalysisResults({ analysisId: currentAnalysisId });

		if (!lastMonthAnalysisId || !currentAnalysis) {
			return currentAnalysis;
		}

		const lastMonthAnalysis = await aggregateAnalysisResults({ analysisId: lastMonthAnalysisId });

		if (!lastMonthAnalysis) {
			return currentAnalysis;
		}

		return {
			...currentAnalysis,
			data: currentAnalysis.data.map((item) => {
				const lastMonthItem = lastMonthAnalysis.data.find(({ domain }) => domain === item.domain);

				if (!lastMonthItem) {
					// no information about last month
					return { ...item, trend: undefined };
				}

				const currentVolumeShare = item.volume / currentAnalysis.totalVolume;
				const lastMonthVolumeShare = lastMonthItem.volume / lastMonthAnalysis.totalVolume;
				const trend = currentVolumeShare - lastMonthVolumeShare;

				return {
					...item,
					trend,
				};
			}),
		};
	}

	/**
	 * Returns the last month analysis, i.e the most recent analysis that is at least 28 days before the most recent analysis.
	 * If only one analysis found, return undefined.
	 * If two or more analysis but less than one month ago, return the oldest analysis.
	 */
	export function getLastMonthAnalysisId({
		allAnalysis,
	}: {
		allAnalysis: Array<KeywordAnalysisIdAndDate>;
	}): string | undefined {
		if (allAnalysis.length <= 1) return undefined;
		const mostRecentAnalysisAt = allAnalysis[0]?.createdAt;
		if (!mostRecentAnalysisAt) return undefined;
		const analysisOnemonthAgo = allAnalysis.find(
			(analysis) =>
				new Date(analysis.createdAt).getTime() <=
				new Date(mostRecentAnalysisAt).getTime() - 28 * DAY,
		);
		return (analysisOnemonthAgo ?? allAnalysis.at(-1))?.id;
	}
}
