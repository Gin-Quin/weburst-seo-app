// Real ClickHouse, mocked provider: no paid tasks, and an isolated database per run.
import { expect, mock } from "bun:test";
import { createClient } from "@clickhouse/client";
import { clickhouseMigrations } from "../../migrations";
const url = process.env.TEST_CLICKHOUSE_URL!;
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
	throw new Error("Local ClickHouse required");
const database = `test_keyword_retries_${crypto.randomUUID().replaceAll("-", "")}`;
const config = {
	url,
	username: process.env.TEST_CLICKHOUSE_USERNAME ?? "default",
	password: process.env.TEST_CLICKHOUSE_PASSWORD ?? "",
};
const admin = createClient(config);
const client = createClient({ ...config, database });
const POSTBACK_URL = "https://callback.test/secret";
const env: Record<string, string | undefined> = {
	DATA_FOR_SEO_SERP_POSTBACK_URL: POSTBACK_URL,
	DATA_FOR_SEO_LOGIN: "test",
	DATA_FOR_SEO_PASSWORD: "test",
};
mock.module("$env/dynamic/private", () => ({ env }));
mock.module("$lib/server/db", () => ({
	db: { query: { projects: { findFirst: async () => ({ domain: "client.fr" }) } } },
}));
mock.module("../../index", () => ({ getClickhouseClient: () => client }));
const diagnostics: unknown[][] = [];
console.error = (...args) => {
	diagnostics.push(args);
};
console.warn = (...args) => {
	diagnostics.push(args);
};
const providerTasks = new Map<string, any>();
const posts: any[][] = [];
let rejectNextPost = false;
let rateLimitNextPost = false;
let readyIds: string[] = [];
const taskGets: string[] = [];
const envelope = (tasks: any[]) => ({
	version: "test",
	status_code: 20000,
	status_message: "Ok",
	time: "1",
	cost: 0,
	tasks_count: tasks.length,
	tasks_error: 0,
	tasks,
});
globalThis.fetch = Object.assign(
	async (url: any, options: any) => {
		if (options?.method === "POST") {
			const body = JSON.parse(options.body);
			posts.push(body);
			if (rateLimitNextPost) {
				rateLimitNextPost = false;
				return Response.json({ status_code: 40202, status_message: "Rate limit", tasks: [] });
			}
			if (rejectNextPost) {
				rejectNextPost = false;
				throw new Error("Simulated ambiguous submission");
			}
			return Response.json(
				envelope(
					body.map((data: any) => {
						const task = {
							id: crypto.randomUUID(),
							data,
							status_code: 20100,
							status_message: "Created",
							result: null,
						};
						providerTasks.set(task.id, task);
						return task;
					}),
				),
			);
		}
		if (String(url).endsWith("/tasks_ready")) {
			return Response.json(
				envelope([
					{
						id: "ready-list",
						status_code: 20000,
						status_message: "Ok",
						result: readyIds.length ? readyIds.map((id) => ({ id })) : null,
					},
				]),
			);
		}
		taskGets.push(String(url).split("/").at(-1) ?? "");
		const task = providerTasks.get(String(url).split("/").at(-1) ?? "");
		if (!task) throw new Error(`Unexpected provider fetch ${url}`);
		return Response.json(envelope([task]));
	},
	{ preconnect: fetch.preconnect },
);
const { KeywordsService } = await import("../keywords");
const query = async (query: string, query_params: Record<string, any> = {}) =>
	(await (await client.query({ query, query_params, format: "JSON" })).json<any>()).data;
const resultFor = (task: any, code: number, empty = false) => ({
	...task,
	status_code: code,
	status_message: code === 40106 ? "Task completed with partial results" : "Ok",
	result: [
		{
			keyword: task.data.keyword,
			items: empty
				? []
				: [
						{
							type: "organic",
							rank_group: 1,
							rank_absolute: 1,
							domain: "client.fr",
							url: "https://client.fr",
							title: "Result",
							description: "Description",
						},
					],
		},
	],
});
const save = (analysisId: string, task: any, code = 20000, empty = false) =>
	KeywordsService.saveKeywordAnalysisResult({
		analysisId,
		result: envelope([resultFor(task, code, empty)]) as any,
	});
const makeDue = async (analysisId: string) =>
	client.command({
		query:
			"ALTER TABLE keywordAnalysisTasks UPDATE retryAt = 1 WHERE analysisId = {analysisId:UUID} AND retryAt > 0",
		query_params: { analysisId },
		clickhouse_settings: { mutations_sync: "1" },
	});
async function start(keywords: Array<[string, number, string]>) {
	const projectId = crypto.randomUUID();
	await KeywordsService.addKeywords(projectId, keywords);
	const existing = new Set(providerTasks.keys());
	await KeywordsService.startKeywordAnalysis(projectId);
	const tasks = [...providerTasks.values()].filter((task) => !existing.has(task.id));
	return { projectId, analysisId: tasks[0].data.tag, tasks };
}
async function retry(analysisId: string, code: number, empty = false) {
	await makeDue(analysisId);
	await Promise.all([
		KeywordsService.resumeKeywordRetries(analysisId),
		KeywordsService.resumeKeywordRetries(analysisId),
	]);
	const [row] = await query(
		"SELECT providerTaskId FROM keywordAnalysisTasks WHERE analysisId = {analysisId:UUID} AND retryCount > 0",
		{ analysisId },
	);
	const task = providerTasks.get(row.providerTaskId);
	providerTasks.set(task.id, resultFor(task, code, empty));
	await KeywordsService.resumeKeywordRetries(analysisId);
	return task;
}
await admin.command({ query: `CREATE DATABASE ${database}` });
try {
	for (const query of [
		"CREATE TABLE keywordSets (id UUID, projectId String, createdAt DateTime DEFAULT now()) ENGINE = MergeTree ORDER BY id",
		"CREATE TABLE keywords (setId UUID, name String, volume UInt32, clusters String) ENGINE = MergeTree ORDER BY (setId, name)",
		"CREATE TABLE keywordAnalysis (id UUID, projectId String, setId UUID, status String, error String DEFAULT '', createdAt DateTime DEFAULT now()) ENGINE = MergeTree ORDER BY id",
		"CREATE TABLE keywordAnalysisTasks (id UUID, analysisId UUID, status String, error String DEFAULT '', createdAt DateTime DEFAULT now()) ENGINE = MergeTree ORDER BY (analysisId, id)",
		"CREATE TABLE keywordAnalysisResponses (analysisId String, taskId UUID, keyword String, position UInt8, domain String, url String, type String, title String, description String, createdAt DateTime DEFAULT now()) ENGINE = MergeTree ORDER BY (analysisId, taskId)",
		"CREATE TABLE aggregatedKeywordAnalysisData (analysisId UUID, domain String, volume Float64, topThreeKeywordCount UInt32, topTenKeywordCount UInt32, positionnedKeywordCount UInt32, trend Nullable(Float64), createdAt DateTime DEFAULT now()) ENGINE = MergeTree ORDER BY analysisId",
	])
		await client.command({ query });
	for (const name of [
		"Create keyword analysis task results table",
		"Persist keyword analysis retry state",
	]) {
		const queries = clickhouseMigrations
			.find((migration) => migration.name === name)!
			.query(database);
		for (const query of Array.isArray(queries) ? queries : [queries])
			await client.command({ query });
	}
	// One failure cannot abort the other keywords. Partial provider items are never stored.
	const partial = await start([
		["good", 100, "Tools"],
		["bad", 10000, "Tools"],
		["no-results", 200, "Tools"],
	]);
	const [good, bad, noResults] = partial.tasks;
	await save(partial.analysisId, good);
	await Promise.all([save(partial.analysisId, bad, 40106), save(partial.analysisId, bad, 40106)]);
	expect(await KeywordsService.getAnalysisStatus(partial)).toMatchObject({
		status: "pending",
		completedTasks: 1,
		failedTasks: 0,
		retryingTasks: 1,
		totalTasks: 3,
	});
	expect(await KeywordsService.getAnalysisIdFromTaskId({ taskId: bad.id })).toBe(
		partial.analysisId,
	);
	expect(
		(
			await query(
				"SELECT count() AS count FROM keywordAnalysisResponses WHERE taskId = {taskId:UUID}",
				{ taskId: bad.id },
			)
		)[0].count,
	).toBe("0");
	await retry(partial.analysisId, 40106);
	const beforeLate = posts.length;
	await save(partial.analysisId, bad, 20000);
	expect(posts.length).toBe(beforeLate);
	expect((await KeywordsService.getAnalysisStatus(partial)).completedTasks).toBe(1);
	const finalAttempt = await retry(partial.analysisId, 40106);
	expect(await KeywordsService.getAnalysisStatus(partial)).toMatchObject({
		status: "pending",
		failedTasks: 1,
		failedKeywords: ["bad"],
		retryingTasks: 0,
	});
	// Empty, successful SERPs remain in the population; failed keywords do not.
	await save(partial.analysisId, noResults, 20000, true);
	expect(await KeywordsService.getAnalysisStatus(partial)).toMatchObject({
		status: "completed",
		completedTasks: 2,
		failedTasks: 1,
		totalTasks: 3,
	});
	expect(posts.slice(1)).toHaveLength(2);
	expect(
		posts
			.slice(1)
			.flat()
			.every((data) => data.keyword === "bad" && !data.postback_url),
	).toBe(true);
	const metrics = await KeywordsService.getProjectLatestAggregatedAnalysisResults(partial);
	expect(metrics).toMatchObject({
		keywordCount: 2,
		requestedKeywordCount: 3,
		totalVolume: 300,
		totalTraffic: 20,
		failedKeywords: ["bad"],
		previousAnalysisAt: undefined,
	});
	expect(metrics!.clusters[0]).toMatchObject({
		keywordCount: 2,
		totalVolume: 300,
		totalTraffic: 20,
	});
	expect(metrics!.data[0]).toMatchObject({
		volume: 20,
		topThreeKeywordCount: 1,
		topTenKeywordCount: 1,
		positionnedKeywordCount: 1,
		trend: undefined,
	});
	// Even leftover rows from a failed persistence attempt cannot contaminate exports or clusters.
	await client.insert({
		table: "keywordAnalysisResponses",
		format: "JSONEachRow",
		values: [
			{
				analysisId: partial.analysisId,
				taskId: bad.id,
				keyword: "bad",
				position: 1,
				domain: "client.fr",
				url: "https://client.fr",
				type: "organic",
				title: "leftover",
				description: "leftover",
			},
		],
	});
	expect(
		(await KeywordsService.getKeywordAnalysisResponses(partial)).map((row) => row.keyword),
	).toEqual(["good"]);
	expect(
		(await KeywordsService.getProjectLatestAggregatedAnalysisResults(partial))!.clusters[0]!
			.totalTraffic,
	).toBe(20);
	expect(
		(
			await KeywordsService.getAllAggregatedAnalysisResults({ ...partial, clusterNames: ["Tools"] })
		)[0],
	).toMatchObject({ volume: 20, totalVolume: 20 });
	const clusters = await KeywordsService.getKeywordClusters(partial);
	expect(
		clusters!
			.flat()
			.map((row) => row.keyword)
			.sort(),
	).toEqual(["good", "no-results"]);
	const postCount = posts.length;
	await save(partial.analysisId, finalAttempt, 20000);
	await KeywordsService.resumeKeywordRetries(partial.analysisId);
	expect(posts.length).toBe(postCount);
	// A successful retry preserves the original logical task and cannot be counted twice.
	const recovered = await start([["recover", 50, "Tools"]]);
	await save(recovered.analysisId, recovered.tasks[0], 40106);
	const successfulAttempt = await retry(recovered.analysisId, 20000);
	expect(await KeywordsService.getAnalysisStatus(recovered)).toMatchObject({
		status: "completed",
		completedTasks: 1,
		failedTasks: 0,
		failedKeywords: [],
		totalTasks: 1,
	});
	expect(await KeywordsService.getAnalysisIdFromTaskId({ taskId: successfulAttempt.id })).toBe(
		recovered.analysisId,
	);
	const stored = await query(
		"SELECT taskId FROM keywordAnalysisResponses WHERE analysisId = {analysisId:String}",
		recovered,
	);
	expect(stored.map((row: any) => row.taskId)).toEqual([recovered.tasks[0].id]);
	await save(recovered.analysisId, successfulAttempt);
	expect(
		(
			await query(
				"SELECT count() AS count FROM keywordAnalysisResponses WHERE analysisId = {analysisId:String}",
				recovered,
			)
		)[0].count,
	).toBe("1");
	// Reconcile a persisted reservation with an unknown outcome, as after a restart.
	const interrupted = await start([["interrupted", 50, "Tools"]]);
	await save(interrupted.analysisId, interrupted.tasks[0], 40106);
	await makeDue(interrupted.analysisId);
	rejectNextPost = true;
	await KeywordsService.resumeKeywordRetries(interrupted.analysisId);
	expect((await KeywordsService.getAnalysisStatus(interrupted)).status).toBe("pending");
	await retry(interrupted.analysisId, 40106);
	expect(await KeywordsService.getAnalysisStatus(interrupted)).toMatchObject({
		status: "failed",
		failedTasks: 1,
		completedTasks: 0,
		failedKeywords: ["interrupted"],
	});
	expect(await KeywordsService.getProjectLatestAggregatedAnalysisResults(interrupted)).toBeNull();
	// Two ambiguous submissions exhaust the durable budget without an extra paid POST.
	const ambiguous = await start([["ambiguous", 50, "Tools"]]);
	await save(ambiguous.analysisId, ambiguous.tasks[0], 40106);
	for (let attempt = 0; attempt < 2; attempt++) {
		await makeDue(ambiguous.analysisId);
		rejectNextPost = true;
		await KeywordsService.resumeKeywordRetries(ambiguous.analysisId);
	}
	const afterAmbiguous = posts.length;
	await makeDue(ambiguous.analysisId);
	await KeywordsService.reconcilePendingKeywordAnalyses();
	expect(posts.length).toBe(afterAmbiguous);
	expect(await KeywordsService.getAnalysisStatus(ambiguous)).toMatchObject({
		status: "failed",
		failedKeywords: ["ambiguous"],
	});
	// Lost callbacks time out per keyword, preserving successes for publication.
	const stale = await start([
		["saved", 100, "Tools"],
		["lost", 500, "Tools"],
	]);
	await save(stale.analysisId, stale.tasks[0]);
	await client.command({
		query:
			"ALTER TABLE keywordAnalysis UPDATE createdAt = now() - INTERVAL 2 DAY WHERE id = {analysisId:UUID}",
		query_params: stale,
		clickhouse_settings: { mutations_sync: "1" },
	});
	await KeywordsService.failStaleKeywordAnalyses();
	expect(await KeywordsService.getAnalysisStatus(stale)).toMatchObject({
		status: "completed",
		failedKeywords: ["lost"],
		completedTasks: 1,
	});
	expect(await KeywordsService.getProjectLatestAggregatedAnalysisResults(stale)).toMatchObject({
		keywordCount: 1,
		totalVolume: 100,
		totalTraffic: 20,
	});
	// A rate-limited submission is repeated by the client: one analysis, one task, no loss.
	const beforeRateLimit = posts.length;
	rateLimitNextPost = true;
	const limited = await start([["limited", 50, "Tools"]]);
	expect(posts.length - beforeRateLimit).toBe(2);
	expect(await KeywordsService.getAnalysisStatus(limited)).toMatchObject({
		status: "pending",
		totalTasks: 1,
	});
	// Ready tasks are collected in batches: a task that cannot be saved, one still in the provider
	// queue, an unknown one and an already stored one never keep the others from being collected.
	const ready = await start(Array.from({ length: 7 }, (_, index) => [`rdy-${index}`, 10 + index, "Tools"]));
	const readyTask = (name: string) => ready.tasks.find((task) => task.data.keyword === name);
	const poison = readyTask("rdy-0");
	const queued = readyTask("rdy-1");
	const readyGood = ["rdy-2", "rdy-3", "rdy-4", "rdy-5", "rdy-6"].map(readyTask);
	providerTasks.set(poison.id, {
		...poison,
		status_code: 20000,
		result: [{ keyword: "rdy-0", items: null }],
	});
	providerTasks.set(queued.id, { ...queued, status_code: 40602, status_message: "Task In Queue" });
	for (const task of readyGood) providerTasks.set(task.id, resultFor(task, 20000));
	const loggedReady: unknown[][] = [];
	const originalLog = console.log;
	console.log = (...args) => void loggedReady.push(args);
	readyIds = [poison.id, queued.id, ...readyGood.map((task) => task.id), crypto.randomUUID()];
	taskGets.length = 0;
	try {
		await KeywordsService.fetchTasksReady();
	} finally {
		console.log = originalLog;
	}
	expect(loggedReady).toContainEqual(["[dataforseo-tasks-ready]", { count: 8 }]);
	expect(await KeywordsService.getAnalysisStatus(ready)).toMatchObject({
		status: "pending",
		totalTasks: 7,
		completedTasks: 5,
		failedTasks: 0,
	});
	// Each known task is fetched exactly once; the unknown one never reaches the provider.
	expect([...taskGets].sort()).toEqual([poison.id, queued.id, ...readyGood.map((task) => task.id)].sort());
	expect(JSON.stringify(diagnostics)).toContain(`Error collecting ready task ${poison.id}`);
	expect(JSON.stringify(diagnostics)).toContain("No analysis ID found for task");
	// The task that was still queued is collected on a later pass; stored ones are not fetched again.
	providerTasks.set(queued.id, resultFor(queued, 20000));
	readyIds = [poison.id, queued.id, readyGood[0].id];
	taskGets.length = 0;
	await KeywordsService.fetchTasksReady();
	expect([...taskGets].sort()).toEqual([poison.id, queued.id].sort());
	expect(await KeywordsService.getAnalysisStatus(ready)).toMatchObject({
		status: "pending",
		completedTasks: 6,
	});
	readyIds = [];
	// An empty tasks_ready answer (result: null) is harmless.
	await KeywordsService.fetchTasksReady();
	// A task that finished is not collected twice and not returned to the provider.
	taskGets.length = 0;
	await KeywordsService.collectKeywordAnalysisTask({ analysisId: ready.analysisId, taskId: readyGood[0].id });
	expect(taskGets).toEqual([]);
	// Results need a postback URL: refuse before creating an analysis or spending on tasks.
	const noPostbackProject = crypto.randomUUID();
	await KeywordsService.addKeywords(noPostbackProject, [["no-postback", 1, "Tools"]]);
	const postsBeforeMissingUrl = posts.length;
	delete env.DATA_FOR_SEO_SERP_POSTBACK_URL;
	await expect(KeywordsService.startKeywordAnalysis(noPostbackProject)).rejects.toThrow(
		"DATA_FOR_SEO_SERP_POSTBACK_URL",
	);
	env.DATA_FOR_SEO_SERP_POSTBACK_URL = POSTBACK_URL;
	expect(posts.length).toBe(postsBeforeMissingUrl);
	expect(
		(
			await query(
				"SELECT count() AS count FROM keywordAnalysis WHERE projectId = {projectId:String}",
				{ projectId: noPostbackProject },
			)
		)[0].count,
	).toBe("0");
	// Initial submissions register the postback, with the regular result format.
	expect(posts[0]!.every((data: any) => data.postback_url === POSTBACK_URL && data.postback_data === "regular")).toBe(
		true,
	);
	// At most 100 tasks per request, every keyword submitted once.
	const postsBeforeBulk = posts.length;
	const bulk = await start(Array.from({ length: 150 }, (_, index) => [`bulk-${index}`, 1, "Tools"]));
	const bulkPosts = posts.slice(postsBeforeBulk);
	expect(bulkPosts.map((body) => body.length).sort((a, b) => a - b)).toEqual([50, 100]);
	expect(new Set(bulkPosts.flat().map((data: any) => data.keyword)).size).toBe(150);
	expect(bulk.tasks).toHaveLength(150);
	const empty = await start([["empty", 30, "Tools"]]);
	await save(empty.analysisId, empty.tasks[0], 20000, true);
	expect(await KeywordsService.getProjectLatestAggregatedAnalysisResults(empty)).toMatchObject({
		totalTraffic: 0,
		totalVolume: 30,
		keywordCount: 1,
		data: [],
	});
	expect(JSON.stringify(diagnostics)).not.toContain("callback.test/secret");
	console.log(
		"Retry recovery, partial completion, exclusions, empty results and duplicate callback checks passed",
	);
} finally {
	await client.close();
	await admin.command({ query: `DROP DATABASE IF EXISTS ${database}` });
	await admin.close();
}
