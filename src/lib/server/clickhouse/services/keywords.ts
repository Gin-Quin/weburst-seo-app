import { env } from "$env/dynamic/private";
import {
	getKeywordClusterSummaries,
	type KeywordClusterSummary,
} from "$lib/keywords/getKeywordClusterSummaries";
import { getWeightedVolume } from "$lib/keywords/getWeightedVolume";
import { getSimilarity } from "$lib/numbers/getSimilarity";
import { db } from "$lib/server/db";
import { projects } from "$lib/server/db/schema";
import { normalizeUrlForSimilarity } from "$lib/strings/normalizeUrlForSimilarity";
import { DAY, MINUTE } from "$lib/timeUnits";
import { and, inArray, isNull } from "drizzle-orm";
import { getClickhouseClient } from "../index";
import type { ClickhouseTable } from "../migrations";
import { parseClickhouseCsvRows } from "../parseClickhouseCsvRow";
import type { DataForSeo } from "./DataForSeo";
import { getAnalysisCompletionOutcome } from "./analysisCompletion";
import {
	runDueProjectAnalyses,
	selectProjectsDueForAnalysis,
	type LatestAnalysisState,
} from "./analysisScheduler";
import { getReadySerpTasks } from "./getReadySerpTasks";
import { selectLatestAnalysisPerDay } from "./selectLatestAnalysisPerDay";

const ANALYSIS_DEPTH = env.SEARCH_DEPTH;
const SIMILARITY_THRESHOLD = 0.6;

export type KeywordTuple =
	| [name: string, volume: number]
	| [name: string, volume: number, clusters: string];
export type Keyword = { name: string; volume: number; clusters: string };
export type KeywordSet = { setId: string; createdAt: string };

export type KeywordAnalysisInput = Omit<ClickhouseTable.KeywordAnalysis, "createdAt">;
export type KeywordAnalysisIdAndDate = Pick<ClickhouseTable.KeywordAnalysis, "id" | "createdAt">;

export type KeywordAnalysisStatus = {
	analysisId: string;
	status: ClickhouseTable.KeywordAnalysis["status"];
	totalTasks: number;
	keywordsCount: number;
	completedTasks: number;
	failedTasks: number;
};

export type AggregatedKeywordAnalysis = {
	totalVolume: number;
	keywordCount: number;
	clusters: Array<KeywordClusterSummary>;
	data: Array<ClickhouseTable.AggregatedKeywordAnalysisData>;
};

export type AggregatedKeywordAnalysisData = ClickhouseTable.AggregatedKeywordAnalysisData;

export type KeywordAnalysisTaskInput = Omit<ClickhouseTable.KeywordAnalysisTask, "createdAt">;
export type KeywordAnalysisTaskResultInput = Omit<
	ClickhouseTable.KeywordAnalysisTaskResult,
	"createdAt" | "version"
>;

export type KeywordAnalysisResponseInput = Omit<
	ClickhouseTable.KeywordAnalysisResponse,
	"createdAt"
>;
export type KeywordAnalysisMinimalResponse = Pick<
	ClickhouseTable.KeywordAnalysisResponse,
	"keyword" | "domain" | "position"
>;

type AnalysisMetadata = Pick<ClickhouseTable.KeywordAnalysis, "projectId" | "setId">;

type AnalysisTaskStats = Pick<
	KeywordAnalysisStatus,
	"status" | "totalTasks" | "completedTasks" | "failedTasks"
>;

export type KeywordCluster = Array<KeywordClusterData>;

export type KeywordClusterData = {
	keyword: string;
	volume: number;
	clusters: string;
	items: Array<KeywordClusterItem>;
};

export type KeywordClusterItem = {
	domain: string;
	url: string;
	position: number;
};

export namespace KeywordsService {
	const ANALYSIS_TIMEOUT = DAY;
	const analysisMetadata = new Map<string, AnalysisMetadata>();
	const keywordsBySetId = new Map<string, Map<string, number>>();
	const keywordDetailsBySetId = new Map<string, Map<string, Keyword>>();
	const analysisStartLocks = new Map<string, Promise<"ok">>();
	const taskSaveLocks = new Map<string, Promise<void>>();
	const analysisCompletionLocks = new Map<string, Promise<void>>();
	let scheduledAnalysisRun: Promise<void> | undefined;

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

	async function updateAnalysisState({
		analysisId,
		status,
		error = "",
	}: {
		analysisId: string;
		status: ClickhouseTable.KeywordAnalysis["status"];
		error?: string;
	}): Promise<void> {
		const clickhouse = getClickhouseClient();
		await clickhouse.command({
			query: `
				ALTER TABLE keywordAnalysis
				UPDATE status = {status:String}, error = {error:String}
				WHERE id = {analysisId:UUID}
			`,
			query_params: { analysisId, status, error },
			clickhouse_settings: { mutations_sync: "1" },
		});
	}

	async function recordTaskResult({
		analysisId,
		taskId,
		status,
		itemCount = 0,
		error = "",
	}: {
		analysisId: string;
		taskId: string;
		status: KeywordAnalysisTaskResultInput["status"];
		itemCount?: number;
		error?: string;
	}): Promise<void> {
		const clickhouse = getClickhouseClient();
		await clickhouse.insert<KeywordAnalysisTaskResultInput>({
			table: "keywordAnalysisTaskResults",
			values: [{ analysisId, taskId, status, itemCount, error }],
			format: "JSON",
		});
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
		const previousCheck = analysisCompletionLocks.get(analysisId) ?? Promise.resolve();
		const currentCheck = previousCheck
			.catch(() => undefined)
			.then(async () => {
				const [keywordsCount, stats] = await Promise.all([
					getKeywordsCount(analysisId),
					getAnalysisTaskStats(analysisId),
				]);
				if (stats.status !== "pending") return;
				const outcome = getAnalysisCompletionOutcome({
					keywordsCount,
					startedTasks: stats.totalTasks,
					completedTasks: stats.completedTasks,
					failedTasks: stats.failedTasks,
				});
				if (outcome === "pending") return;

				if (outcome === "failed") {
					await updateAnalysisState({
						analysisId,
						status: "failed",
						error: `${stats.failedTasks}/${stats.totalTasks} keyword analysis tasks failed`,
					});
					return;
				}

				console.log(`✅ Analysis ${analysisId} is complete`);
				await aggregateAnalysisResults({ analysisId });
				await updateAnalysisState({ analysisId, status: "completed" });
			});

		analysisCompletionLocks.set(analysisId, currentCheck);
		try {
			await currentCheck;
		} finally {
			if (analysisCompletionLocks.get(analysisId) === currentCheck) {
				analysisCompletionLocks.delete(analysisId);
			}
		}
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

		const keywordDetails = new Map(
			uniqueKeywords.map(([name, volume, clusters = ""]) => [
				name,
				{ name, volume, clusters: clusters.trim() },
			]),
		);
		keywordDetailsBySetId.set(setId, keywordDetails);
		keywordsBySetId.set(
			setId,
			new Map([...keywordDetails].map(([name, keyword]) => [name, keyword.volume])),
		);

		await clickhouse.insert({
			table: "keywordSets",
			values: [{ id: setId, projectId }],
			format: "JSON",
		});

		await clickhouse.insert({
			table: "keywords",
			values: [...keywordDetails.values()].map(({ name, volume, clusters }) => ({
				setId,
				name,
				volume,
				clusters,
			})),
			format: "JSON",
		});
	}

	/** Return all persisted keyword fields for a specific set. */
	export async function getKeywordDetails(setId: string): Promise<Map<string, Keyword>> {
		const cached = keywordDetailsBySetId.get(setId);
		if (cached) return cached;

		const clickhouse = getClickhouseClient();
		const response = await clickhouse.query({
			query: `
				SELECT name, volume, clusters
				FROM keywords
				WHERE setId = {setId:UUID}
				ORDER BY volume DESC
			`,
			format: "CSV",
			query_params: { setId },
		});

		const data = new Map<string, Keyword>();
		for await (const rows of response.stream()) {
			const parsedRows = parseClickhouseCsvRows(rows, {
				name: "string",
				volume: "number",
				clusters: "string",
			});
			for (const keyword of parsedRows) {
				if (!data.has(keyword.name)) data.set(keyword.name, keyword);
			}
		}

		keywordDetailsBySetId.set(setId, data);
		keywordsBySetId.set(setId, new Map([...data].map(([name, keyword]) => [name, keyword.volume])));
		return data;
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

		const cached = keywordsBySetId.get(setId);
		if (cached) {
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
	export function startKeywordAnalysis(projectId: string, { priority = 2 } = {}): Promise<"ok"> {
		const previousStart = analysisStartLocks.get(projectId) ?? Promise.resolve("ok" as const);
		const currentStart = previousStart
			.catch(() => "ok" as const)
			.then(() => startKeywordAnalysisUnlocked(projectId, { priority }));

		analysisStartLocks.set(projectId, currentStart);
		const clearStartLock = () => {
			if (analysisStartLocks.get(projectId) === currentStart) {
				analysisStartLocks.delete(projectId);
			}
		};
		void currentStart.then(clearStartLock, clearStartLock);

		return currentStart;
	}

	async function startKeywordAnalysisUnlocked(
		projectId: string,
		{ priority }: { priority: number },
	): Promise<"ok"> {
		const pendingAnalysisId = await getProjectPendingAnalysisId(projectId);
		if (pendingAnalysisId) {
			console.log(
				`Skipping analysis for project ${projectId}; analysis ${pendingAnalysisId} is still pending`,
			);
			return "ok";
		}

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

		const taskIdsToPoll: string[] = [];

		try {
			const chunkResults = await Promise.allSettled(
				chunks.map(async (chunk) => {
					const body = chunk.map(([keyword]) => ({
						keyword,
						tag: analysisId,
						location_code: 2250,
						language_code: "fr",
						depth: ANALYSIS_DEPTH,
						priority,
						...callbackOptions,
					}));

					console.log(
						`Starting keyword analysis chunk ${chunks.indexOf(chunk) + 1}/${chunks.length}`,
					);
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
						throw new Error(`Error starting keyword analysis: ${result.status_message}`);
					}

					const taskRows: KeywordAnalysisTaskInput[] = [];
					for (const task of result.tasks) {
						taskRows.push({
							id: task.id,
							analysisId: analysisId,
							status: task.status_code === 20100 ? "pending" : "failed",
							error: task.status_code === 20100 ? undefined : task.status_message,
						});

						if (task.status_code === 20100) {
							console.log(`🏗️  Task ${task.id} started successfully.`);
							if (!env.DATA_FOR_SEO_SERP_POSTBACK_URL) {
								taskIdsToPoll.push(task.id);
							}
						} else {
							console.error(
								`⚠️ Task ${task.id} failed with status code ${task.status_code}: ${task.status_message}`,
							);
						}
					}

					// Persist provider task IDs per chunk. If another chunk fails, callbacks
					// for successful chunks can still be correlated and saved safely.
					if (taskRows.length > 0) {
						await clickhouse.insert<KeywordAnalysisTaskInput>({
							table: "keywordAnalysisTasks",
							values: taskRows,
							format: "JSON",
						});
					}

					if (result.tasks.length !== chunk.length) {
						throw new Error(
							`DataForSEO created ${result.tasks.length}/${chunk.length} expected tasks`,
						);
					}
				}),
			);

			const failedChunk = chunkResults.find(
				(result): result is PromiseRejectedResult => result.status === "rejected",
			);
			if (failedChunk) throw failedChunk.reason;
		} catch (error) {
			await updateAnalysisState({
				analysisId,
				status: "failed",
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}

		for (const taskId of taskIdsToPoll) {
			setTimeout(() => pollKeywordAnalysisTask({ analysisId, taskId }), 1000);
		}

		await checkAnalysisCompletionAndTriggerNext({ analysisId });

		return "ok";
	}

	async function getProjectPendingAnalysisId(projectId: string): Promise<string | null> {
		const clickhouse = getClickhouseClient();
		const response = await clickhouse.query({
			query: `
				SELECT id
				FROM keywordAnalysis
				WHERE projectId = {projectId:String} AND status = 'pending'
				ORDER BY createdAt DESC
				LIMIT 1
			`,
			query_params: { projectId },
			format: "JSON",
		});
		const result = await response.json<{ id: string }>();
		return result.data[0]?.id ?? null;
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

		const task = result.tasks.find((item) => item.id === taskId);
		if (!task) {
			const error = `DataForSEO response did not contain task ${taskId}: ${result.status_message}`;
			console.error(error);
			await recordTaskResult({ analysisId, taskId, status: "failed", error });
			await checkAnalysisCompletionAndTriggerNext({ analysisId });
			return;
		}

		// Got the result, save it in database
		await saveKeywordAnalysisResult({ analysisId, result: { ...result, tasks: [task] } });
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
		await Promise.all(
			result.tasks.map(async (task) => {
				const lockId = `${analysisId}:${task.id}`;
				const previousSave = taskSaveLocks.get(lockId) ?? Promise.resolve();
				const currentSave = previousSave
					.catch(() => undefined)
					.then(() => saveKeywordAnalysisTask({ analysisId, task }));

				taskSaveLocks.set(lockId, currentSave);
				try {
					await currentSave;
				} finally {
					if (taskSaveLocks.get(lockId) === currentSave) {
						taskSaveLocks.delete(lockId);
					}
				}
			}),
		);

		await checkAnalysisCompletionAndTriggerNext({ analysisId });
	}

	async function saveKeywordAnalysisTask({
		analysisId,
		task,
	}: {
		analysisId: string;
		task: DataForSeo.Serp.Task;
	}): Promise<void> {
		const storedTask = await getAnalysisTaskPersistence({ analysisId, taskId: task.id });
		if (!storedTask) {
			throw new Error(`Task ${task.id} does not belong to analysis ${analysisId}`);
		}
		if (storedTask.status !== "pending") return;

		if (task.status_code !== 20000 || task.result == null) {
			const error =
				task.status_code !== 20000
					? `${task.status_code}: ${task.status_message}`
					: "Task completed without result data";
			console.warn(`Cannot save result for task ${task.id}: ${error}`);
			if (storedTask.persistedItems > 0) {
				await deletePersistedTaskItems({ analysisId, taskId: task.id });
			}
			await recordTaskResult({ analysisId, taskId: task.id, status: "failed", error });
			return;
		}

		const values: KeywordAnalysisResponseInput[] = [];
		for (const { keyword, items } of task.result) {
			for (const item of items) {
				values.push({
					analysisId,
					taskId: task.id,
					keyword,
					position: item.rank_group,
					domain: item.domain,
					url: item.url,
					type: item.type,
					title: item.title,
					description: item.description,
				});
			}
		}

		const clickhouse = getClickhouseClient();
		let persistedItems = storedTask.persistedItems;

		// A previous interrupted attempt may have left only part of the task in the
		// response table. Replace that partial block before retrying the full result.
		if (persistedItems !== 0 && persistedItems !== values.length) {
			await deletePersistedTaskItems({ analysisId, taskId: task.id });
			persistedItems = 0;
		}

		if (persistedItems === 0 && values.length > 0) {
			await clickhouse.insert<KeywordAnalysisResponseInput>({
				table: "keywordAnalysisResponses",
				values,
				format: "JSON",
			});
		}

		const savedItems = await getPersistedTaskItemsCount({ analysisId, taskId: task.id });
		if (savedItems !== values.length) {
			throw new Error(
				`Saved ${savedItems}/${values.length} items for task ${task.id}; task remains pending for retry`,
			);
		}

		await recordTaskResult({
			analysisId,
			taskId: task.id,
			status: "completed",
			itemCount: savedItems,
		});
		console.log(`✨  Saved and verified ${savedItems} items for task ${task.id}.`);
	}

	async function getAnalysisTaskPersistence({
		analysisId,
		taskId,
	}: {
		analysisId: string;
		taskId: string;
	}): Promise<
		(Pick<ClickhouseTable.KeywordAnalysisTask, "status"> & { persistedItems: number }) | null
	> {
		const clickhouse = getClickhouseClient();
		const response = await clickhouse.query({
			query: `
				SELECT
					if(empty(results.status), tasks.status, results.status) AS status,
					(
						SELECT count(*)
						FROM keywordAnalysisResponses
						WHERE analysisId = {analysisIdString:String} AND taskId = {taskId:UUID}
					) AS persistedItems
				FROM keywordAnalysisTasks AS tasks
				LEFT JOIN
				(
					SELECT analysisId, taskId, status
					FROM keywordAnalysisTaskResults FINAL
					WHERE analysisId = {analysisId:UUID} AND taskId = {taskId:UUID}
				) AS results
					ON results.analysisId = tasks.analysisId AND results.taskId = tasks.id
				WHERE tasks.analysisId = {analysisId:UUID} AND tasks.id = {taskId:UUID}
				LIMIT 1
			`,
			query_params: { analysisId, analysisIdString: analysisId, taskId },
			format: "JSON",
		});
		const result = await response.json<{
			status: ClickhouseTable.KeywordAnalysisTask["status"];
			persistedItems: string;
		}>();
		const data = result.data[0];
		return data
			? { status: data.status, persistedItems: Number.parseInt(data.persistedItems, 10) }
			: null;
	}

	async function getPersistedTaskItemsCount({
		analysisId,
		taskId,
	}: {
		analysisId: string;
		taskId: string;
	}): Promise<number> {
		const clickhouse = getClickhouseClient();
		const response = await clickhouse.query({
			query: `
				SELECT count(*) AS total
				FROM keywordAnalysisResponses
				WHERE analysisId = {analysisId:String} AND taskId = {taskId:UUID}
			`,
			query_params: { analysisId, taskId },
			format: "JSON",
		});
		const result = await response.json<{ total: string }>();
		return Number.parseInt(result.data[0]?.total ?? "0", 10);
	}

	async function deletePersistedTaskItems({
		analysisId,
		taskId,
	}: {
		analysisId: string;
		taskId: string;
	}): Promise<void> {
		const clickhouse = getClickhouseClient();
		await clickhouse.command({
			query: `
				ALTER TABLE keywordAnalysisResponses DELETE
				WHERE analysisId = {analysisId:String} AND taskId = {taskId:UUID}
			`,
			query_params: { analysisId, taskId },
			clickhouse_settings: { mutations_sync: "1" },
		});
	}

	/**
	 * Return the ID of the latest analysis for a project.
	 */
	export async function getProjectLastAnalysisId({
		projectId,
		status = "completed",
	}: {
		projectId: string;
		status?: "completed" | null;
	}): Promise<string | null> {
		const clickhouse = getClickhouseClient();

		const response = await clickhouse.query({
			query: `
				SELECT id
				FROM keywordAnalysis
				WHERE projectId = {projectId: String}
				${status ? `AND status = '${status}'` : ""}
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

		return data;
	}

	/**
	 * Return the number of started and processed tasks for given analysis.
	 */
	export async function getAnalysisStatus({
		analysisId,
	}: {
		analysisId: string;
	}): Promise<KeywordAnalysisStatus> {
		const [stats, keywordsCount] = await Promise.all([
			getAnalysisTaskStats(analysisId),
			getKeywordsCount(analysisId),
		]);

		return {
			analysisId,
			...stats,
			keywordsCount,
		};
	}

	async function getAnalysisTaskStats(analysisId: string): Promise<AnalysisTaskStats> {
		const clickhouse = getClickhouseClient();
		const response = await clickhouse.query({
			query: `
				SELECT
					(
						SELECT status
						FROM keywordAnalysis
						WHERE id = {analysisId:UUID}
						LIMIT 1
					) AS analysisStatus,
					count(*) AS totalTasks,
					countIf(if(empty(results.status), tasks.status, results.status) = 'completed') AS completedTasks,
					countIf(if(empty(results.status), tasks.status, results.status) = 'failed') AS failedTasks
				FROM keywordAnalysisTasks AS tasks
				LEFT JOIN
				(
					SELECT analysisId, taskId, status
					FROM keywordAnalysisTaskResults FINAL
					WHERE analysisId = {analysisId:UUID}
				) AS results
					ON results.analysisId = tasks.analysisId AND results.taskId = tasks.id
				WHERE tasks.analysisId = {analysisId:UUID}
			`,
			query_params: { analysisId },
			format: "JSON",
		});
		const result = await response.json<{
			analysisStatus: ClickhouseTable.KeywordAnalysis["status"];
			totalTasks: string;
			completedTasks: string;
			failedTasks: string;
		}>();
		const data = result.data[0];
		if (!data?.analysisStatus) {
			throw new Error(`Analysis ${analysisId} was not found`);
		}

		return {
			status: data.analysisStatus,
			totalTasks: Number.parseInt(data.totalTasks, 10),
			completedTasks: Number.parseInt(data.completedTasks, 10),
			failedTasks: Number.parseInt(data.failedTasks, 10),
		};
	}

	/**
	 * Returns the count of started tasks for a given analysis.
	 */
	export async function getStartedTasksCount(analysisId: string): Promise<number> {
		return (await getAnalysisTaskStats(analysisId)).totalTasks;
	}

	/**
	 * Returns the count of started tasks for a given analysis.
	 */
	export async function getKeywordsCount(analysisId: string): Promise<number> {
		const analysis = await getAnalysisMetadata({ analysisId });
		if (!analysis) return 0;

		const { setId } = analysis;
		const keywords = await getKeywords({ setId });
		return keywords?.size ?? 0;
	}

	/**
	 * Return the number of completed tasks for a given anaysis.
	 */
	export async function getCompletedTasksCount(analysisId: string): Promise<number> {
		return (await getAnalysisTaskStats(analysisId)).completedTasks;
	}

	/** Return the number of tasks that reached a terminal failure. */
	export async function getFailedTasksCount(analysisId: string): Promise<number> {
		return (await getAnalysisTaskStats(analysisId)).failedTasks;
	}

	/**
	 * Return the keyword analysis responses for a given analysis.
	 */
	export async function getKeywordAnalysisResponses({
		analysisId,
		positionLimit,
		limit,
		offset = 0,
	}: {
		analysisId: string;
		positionLimit?: number;
		limit?: number;
		offset?: number;
	}): Promise<Array<KeywordAnalysisMinimalResponse>> {
		const clickhouse = getClickhouseClient();

		const response = await clickhouse.query({
			query: `
				SELECT keyword, position, domain
				FROM keywordAnalysisResponses
				WHERE analysisId = {analysisId:String}
				${positionLimit ? `AND position <= ${positionLimit} ORDER BY position ASC` : ""}
				${limit === undefined ? "" : "LIMIT {limit:UInt64} OFFSET {offset:UInt64}"}
			`,
			query_params: { analysisId, limit: limit ?? 0, offset },
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

		const data = await getKeywordAnalysisResponses({ analysisId, positionLimit });

		const totalVolume = getTotalVolume(keywords);
		const distinctKeywords = new Set<string>();
		const distinctKeywordsByDomain = new Map<string, Map<string, number>>();
		const dataByDomain: Record<string, Omit<AggregatedKeywordAnalysisData, "createdAt">> = {};

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
				volume: 0,
				topThreeKeywordCount: 0,
				topTenKeywordCount: 0,
				positionnedKeywordCount: 0,
				trend: undefined,
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

		const valuesToInsert = Object.values(dataByDomain).sort((a, b) => b.volume - a.volume);

		for (const item of valuesToInsert) {
			item.volume = Math.round(item.volume);
		}

		if (lastMonth) {
			for (const valueToInsert of valuesToInsert) {
				const domain = valueToInsert.domain;
				const domainLastMonth = lastMonth.data.find((item) => item.domain === domain);
				if (domainLastMonth) {
					const currentVolumeShare = valueToInsert.volume / totalVolume;
					const lastMonthVolumeShare = domainLastMonth.volume / lastMonth.totalVolume;
					valueToInsert.trend = currentVolumeShare - lastMonthVolumeShare;
				}
			}
		}

		const clickhouse = getClickhouseClient();

		await clickhouse.insert({
			table: "aggregatedKeywordAnalysisData",
			values: valuesToInsert,
			format: "JSONEachRow",
		});
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
	 * Get the latest aggregation for the given project.
	 */
	export async function getProjectLatestAggregatedAnalysisResults({
		projectId,
	}: {
		projectId: string;
	}): Promise<null | AggregatedKeywordAnalysis> {
		const analysisId = await getProjectLastAnalysisId({ projectId });
		if (!analysisId) return null;

		const analysis = await getAnalysisMetadata({ analysisId });
		if (!analysis) return null;

		const keywordDetails = await getKeywordDetails(analysis.setId);
		const keywords = await getKeywords({ setId: analysis.setId });
		if (!keywords) return null;

		const totalVolume = getTotalVolume(keywords);

		const data = await getAggregatedAnalysisResults({
			analysisId,
			limit: 100,
		});
		if (!data) return null;

		return {
			keywordCount: keywords.size,
			totalVolume,
			clusters: getKeywordClusterSummaries(keywordDetails.values()),
			data,
		};
	}

	/**
	 * Return the given aggregated analysis results.
	 */
	export async function getAllAggregatedAnalysisResults({
		projectId,
		domain,
		domainLimit,
	}: {
		projectId: string;
		domain?: string;
		domainLimit?: number;
	}): Promise<
		Array<
			Pick<ClickhouseTable.AggregatedKeywordAnalysisData, "createdAt" | "domain" | "volume"> & {
				totalVolume: number;
			}
		>
	> {
		const clickhouse = getClickhouseClient();
		const allAnalysis = selectLatestAnalysisPerDay(await getAllProjectAnalysis(projectId));
		if (allAnalysis.length === 0) return [];

		const analysisIds = allAnalysis.map((analysis) => analysis.id);
		const latestAnalysisId = allAnalysis[0]!.id;
		const response = await clickhouse.query({
			query: `
				WITH selectedDomains AS
				(
					SELECT domain
					FROM aggregatedKeywordAnalysisData
					WHERE analysisId = {latestAnalysisId:UUID}
					ORDER BY volume DESC
					${domainLimit ? "LIMIT {domainLimit:UInt32}" : ""}
				),
				analysisTotals AS
				(
					SELECT setId, sum(volume) AS totalVolume
					FROM keywords
					WHERE setId IN
					(
						SELECT setId
						FROM keywordAnalysis
						WHERE id IN {analysisIds:Array(UUID)}
					)
					GROUP BY setId
				)
				SELECT
					analysis.createdAt AS createdAt,
					aggregated.domain AS domain,
					aggregated.volume AS volume,
					analysisTotals.totalVolume AS totalVolume
				FROM aggregatedKeywordAnalysisData AS aggregated
				INNER JOIN keywordAnalysis AS analysis ON analysis.id = aggregated.analysisId
				INNER JOIN analysisTotals ON analysisTotals.setId = analysis.setId
				WHERE aggregated.analysisId IN {analysisIds:Array(UUID)}
				${domain ? "AND aggregated.domain = {domain:String}" : "AND aggregated.domain IN (SELECT domain FROM selectedDomains)"}
				ORDER BY analysis.createdAt ASC, aggregated.domain ASC
			`,
			query_params: {
				analysisIds,
				latestAnalysisId,
				domain: domain ?? "",
				domainLimit: domainLimit ?? 0,
			},
			format: "CSV",
		});

		let data: Array<
			Pick<ClickhouseTable.AggregatedKeywordAnalysisData, "createdAt" | "domain" | "volume"> & {
				totalVolume: number;
			}
		> = [];
		const stream = response.stream();

		for await (const rows of stream) {
			data = data.concat(
				parseClickhouseCsvRows(rows, {
					createdAt: "string",
					domain: "string",
					volume: "number",
					totalVolume: "number",
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
				ORDER BY volume DESC
				${limit ? "LIMIT {limit:UInt32}" : ""}
			`,
			query_params: { analysisId, domain: domain ?? "", limit: limit ?? 0 },
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
		const analysisId = await getProjectLastAnalysisId({ projectId });
		if (!analysisId) return null;

		const analysis = await getAnalysisMetadata({ analysisId });
		if (!analysis) return null;
		const { setId } = analysis;

		const keywords = await getKeywords({ setId });
		if (!keywords?.size) return null;
		const keywordDetails = await getKeywordDetails(setId);

		const clickhouse = getClickhouseClient();

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

		const stream = response.stream();
		const dataByKeyword: Record<
			string,
			Array<Pick<ClickhouseTable.KeywordAnalysisResponse, "domain" | "url" | "position">>
		> = {};

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

		const clusters: Array<KeywordCluster> = [];

		// Strategy 1: Pre-compute deduplicated items with normalized URLs
		const deduplicatedDataByKeyword = new Map<string, Array<KeywordClusterItem>>();
		const normalizedUrlSetsByKeyword = new Map<string, Set<string>>();

		for (const keyword in dataByKeyword) {
			const items = dataByKeyword[keyword]!;
			const deduplicatedItems: Array<KeywordClusterItem> = [];
			const normalizedUrls = new Set<string>();

			for (const item of items) {
				const normalizedUrl = normalizeUrlForSimilarity(item.url);
				if (!normalizedUrls.has(normalizedUrl)) {
					deduplicatedItems.push({ ...item, url: normalizedUrl });
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
					clusters: keywordDetails.get(keyword)?.clusters ?? "",
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
						clusters: keywordDetails.get(otherKeyword)?.clusters ?? "",
					});

					clusteredKeywords.add(otherKeyword);
				}
			}

			cluster.sort((a, b) => b.volume - a.volume);
			clusters.push(cluster);
		}

		clusters.sort((a, b) => getClusterVolume(b) - getClusterVolume(a));

		return clusters;
	}

	export function getClusterVolume(cluster: KeywordCluster) {
		return cluster.reduce((acc, item) => acc + item.volume, 0);
	}

	async function getLatestAnalysisByProjectId(
		projectIds: string[],
	): Promise<Map<string, LatestAnalysisState>> {
		if (projectIds.length === 0) return new Map();

		const clickhouse = getClickhouseClient();
		const response = await clickhouse.query({
			query: `
				SELECT
					projectId,
					argMax(status, tuple(createdAt, id)) AS status,
					toUnixTimestamp(argMax(createdAt, tuple(createdAt, id))) * 1000 AS createdAtMs
				FROM keywordAnalysis
				WHERE projectId IN {projectIds:Array(String)}
				GROUP BY projectId
			`,
			query_params: { projectIds },
			format: "JSON",
		});
		const result = await response.json<{
			projectId: string;
			status: ClickhouseTable.KeywordAnalysis["status"];
			createdAtMs: string;
		}>();

		return new Map(
			result.data.map(({ projectId, status, createdAtMs }) => [
				projectId,
				{ status, createdAtMs: Number.parseInt(createdAtMs, 10) },
			]),
		);
	}

	async function getProjectIdsWithCurrentKeywords(projectIds: string[]): Promise<Set<string>> {
		if (projectIds.length === 0) return new Set();

		const clickhouse = getClickhouseClient();
		const response = await clickhouse.query({
			query: `
				SELECT currentSets.projectId
				FROM
				(
					SELECT projectId, argMax(id, tuple(createdAt, id)) AS setId
					FROM keywordSets
					WHERE projectId IN {projectIds:Array(String)}
					GROUP BY projectId
				) AS currentSets
				INNER JOIN keywords ON keywords.setId = currentSets.setId
				GROUP BY currentSets.projectId
				HAVING count(*) > 0
			`,
			query_params: { projectIds },
			format: "JSON",
		});
		const result = await response.json<{ projectId: string }>();
		return new Set(result.data.map(({ projectId }) => projectId));
	}

	/** Check every active project with recurring analysis and start analyses whose interval elapsed. */
	export function startAllKeywordAnalysis(): Promise<void> {
		if (scheduledAnalysisRun) {
			console.log("Keyword analysis scheduler is already running; skipping overlapping run");
			return scheduledAnalysisRun;
		}

		const currentRun = runScheduledKeywordAnalyses();
		scheduledAnalysisRun = currentRun;
		const clearScheduledRun = () => {
			if (scheduledAnalysisRun === currentRun) scheduledAnalysisRun = undefined;
		};
		void currentRun.then(clearScheduledRun, clearScheduledRun);
		return currentRun;
	}

	async function runScheduledKeywordAnalyses(): Promise<void> {
		console.log("⏰ Checking for due keyword analyses");

		const recurringAnalysisProjects = await db.query.projects.findMany({
			where: and(
				inArray(projects.type, ["audit", "monthly_subscription"]),
				isNull(projects.deletedAt),
			),
			columns: { id: true, keywordAnalysisFrequency: true },
		});
		const projectIds = recurringAnalysisProjects.map(({ id }) => id);
		const [latestAnalysisByProjectId, projectIdsWithKeywords] = await Promise.all([
			getLatestAnalysisByProjectId(projectIds),
			getProjectIdsWithCurrentKeywords(projectIds),
		]);
		const analyzableProjects = recurringAnalysisProjects.filter(({ id }) =>
			projectIdsWithKeywords.has(id),
		);
		const dueProjects = selectProjectsDueForAnalysis({
			projects: analyzableProjects,
			latestAnalysisByProjectId,
			nowMs: Date.now(),
		});

		console.log(
			`Found ${dueProjects.length}/${analyzableProjects.length} analyzable recurring projects due; ${recurringAnalysisProjects.length - analyzableProjects.length} have no current keywords.`,
		);

		const results = await runDueProjectAnalyses({
			projects: dueProjects,
			startAnalysis: (projectId) => startKeywordAnalysis(projectId, { priority: 1 }),
			waitBetweenProjects: () => new Promise((resolve) => setTimeout(resolve, 2 * MINUTE)),
		});

		for (const result of results) {
			if (result.status === "started") {
				console.log(`Started scheduled analysis for project ${result.projectId}`);
			} else {
				console.error(
					`Error starting scheduled analysis for project ${result.projectId}: ${result.error}`,
				);
			}
		}
	}

	/**
	 * Fail analyses that never received every task result. This is a final safety
	 * net for lost provider callbacks, exhausted polling retries, or process exits.
	 */
	export async function failStaleKeywordAnalyses(): Promise<void> {
		const clickhouse = getClickhouseClient();
		const response = await clickhouse.query({
			query: `
				SELECT id
				FROM keywordAnalysis
				WHERE status = 'pending'
				AND createdAt <= now() - toIntervalSecond({timeoutSeconds:UInt64})
			`,
			query_params: { timeoutSeconds: Math.floor(ANALYSIS_TIMEOUT / 1000) },
			format: "JSON",
		});
		const result = await response.json<Pick<ClickhouseTable.KeywordAnalysis, "id">>();
		const analysisIds = result.data.map(({ id }) => id);
		if (analysisIds.length === 0) return;

		await clickhouse.command({
			query: `
				ALTER TABLE keywordAnalysis
				UPDATE status = 'failed', error = 'Analysis timed out while waiting for task results'
				WHERE id IN {analysisIds:Array(UUID)}
			`,
			query_params: { analysisIds },
			clickhouse_settings: { mutations_sync: "1" },
		});
		console.warn(`Marked ${analysisIds.length} stale keyword analyses as failed`);
	}

	/** Recover completion work that may have been interrupted by a process restart. */
	export async function reconcilePendingKeywordAnalyses(): Promise<void> {
		const clickhouse = getClickhouseClient();
		const response = await clickhouse.query({
			query: `SELECT id FROM keywordAnalysis WHERE status = 'pending'`,
			format: "JSON",
		});
		const result = await response.json<Pick<ClickhouseTable.KeywordAnalysis, "id">>();

		for (const { id: analysisId } of result.data) {
			await checkAnalysisCompletionAndTriggerNext({ analysisId }).catch((error) => {
				console.error(`Error reconciling pending analysis ${analysisId}: ${error}`);
			});
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
			if (result.status_code !== 20000) {
				throw new Error(`Error fetching tasks ready: ${result.status_message}`);
			}

			for (const task of getReadySerpTasks(result)) {
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
		} finally {
			await reconcilePendingKeywordAnalyses().catch((error) => {
				console.error(`Error reconciling pending keyword analyses: ${error}`);
			});
			await failStaleKeywordAnalyses().catch((error) => {
				console.error(`Error failing stale keyword analyses: ${error}`);
			});
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
			query: `SELECT analysisId FROM keywordAnalysisTasks WHERE id = {taskId:UUID} LIMIT 1`,
			query_params: { taskId },
			format: "JSON",
		});
		const result = await response.json<Pick<ClickhouseTable.KeywordAnalysisTask, "analysisId">>();
		return result.data[0]?.analysisId ?? null;
	}
}
