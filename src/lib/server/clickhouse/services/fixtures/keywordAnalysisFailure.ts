// Run in a separate Bun process to keep module mocks out of the other tests.
import { expect, mock } from "bun:test";

mock.module("$env/dynamic/private", () => ({ env: {} }));
mock.module("$lib/server/db", () => ({ db: {} }));
let status = "pending";
let analysisError = "";
let setId = "";
let failNextStateWrite = true;
const taskResults: Array<{ taskId: string; status: string; error: string }> = [];
const writes: string[] = [];
const logs: unknown[][] = [];
console.error = (...args) => {
	logs.push(args);
};
const clickhouse = {
	async insert(input: { table: string; values: any[] }) {
		writes.push(input.table);
		if (input.table === "keywordAnalysisTaskResults") taskResults.push(...input.values);
	},
	async command(input: { query: string; query_params: { status: string; error: string } }) {
		expect(input.query).toContain("AND status = 'pending'");
		if (failNextStateWrite) {
			failNextStateWrite = false;
			throw new Error("Temporary database failure");
		}
		if (status === "pending") {
			status = input.query_params.status;
			analysisError = input.query_params.error;
		}
	},
	async query(input: { query: string }) {
		let data: unknown[];
		if (input.query.includes("AS persistedItems")) {
			data = [{ id: "partial-task", keyword: "keyword-2", request: "{}", retryCount: 2, retryAt: "0", activeTaskId: "partial-task", status: taskResults[0]?.status ?? "pending", persistedItems: "0" }];
		} else if (input.query.includes("AS analysisStatus")) {
			data = [
				{
					analysisStatus: status,
					analysisError,
					taskErrors: taskResults.map((row) => row.error),
					totalTasks: "84",
					completedTasks: "0",
					failedKeywords: ["keyword-2"],
					retryingTasks: "0",
					failedTasks: String(83 + taskResults.length),
				},
			];
		} else if (input.query.includes("SELECT projectId, setId, createdAt")) {
			data = [{ projectId: "project", setId, createdAt: "2026-09-15 09:00:00" }];
		} else if (input.query.includes("SELECT status FROM keywordAnalysis")) {
			data = [{ status }];
		} else {
			throw new Error(`Unexpected query: ${input.query}`);
		}
		return { json: async () => ({ data }) };
	},
};
// Use the resolved file path because this fixture is one directory below the service.
mock.module("../../index", () => ({ getClickhouseClient: () => clickhouse }));
const { KeywordsService } = await import("../keywords");
setId = await KeywordsService.addKeywords(
	"project",
	Array.from({ length: 84 }, (_, i) => [`keyword-${i}`, 100]),
);
const task = {
	id: "partial-task",
	status_code: 40106,
	status_message: "Task completed with partial results",
	time: "1",
	cost: 0.01,
	result_count: 1,
	path: ["serp", "google", "organic"],
	data: {
		keyword: "keyword-2",
		depth: 50,
		postback_url: "https://callback.test/secret",
		location_code: 2250,
		language_code: "fr",
	},
	result: [
		{
			keyword: "keyword-2",
			datetime: "2026-09-15",
			items_count: 1,
			items: [{ type: "organic", rank_group: 1, rank_absolute: 1 }],
		},
	],
};
const response = {
	version: "test",
	status_code: 20000,
	status_message: "Ok",
	time: "1",
	cost: 0.01,
	tasks_count: 1,
	tasks_error: 1,
	tasks: [task],
};
// An entirely failed analysis must still reach its terminal state after a transient state-write failure.
await expect(
	KeywordsService.saveKeywordAnalysisResult({ analysisId: "analysis", result: response as any }),
).rejects.toThrow("Temporary database failure");
await KeywordsService.saveKeywordAnalysisResult({
	analysisId: "analysis",
	result: response as any,
});
expect(status).toBe("failed");
expect(analysisError).toContain("40106:");
expect(taskResults).toHaveLength(1);
expect(writes).not.toContain("keywordAnalysisResponses");
expect(writes).not.toContain("aggregatedKeywordAnalysisData");
const beforeLateCallback = writes.length;
await KeywordsService.saveKeywordAnalysisResult({
	analysisId: "analysis",
	result: { ...response, tasks: [{ ...task, id: "late-success", status_code: 20000 }] } as any,
});
expect(status).toBe("failed");
expect(writes).toHaveLength(beforeLateCallback);
let providerWasPolled = false;
globalThis.fetch = Object.assign(
	async () => {
		providerWasPolled = true;
		throw new Error("Cancelled analyses must not poll the provider");
	},
	{ preconnect: fetch.preconnect },
);
await KeywordsService.collectKeywordAnalysisTask({
	analysisId: "analysis",
	taskId: "late-success",
});
expect(providerWasPolled).toBe(false);
const publicStatus = await KeywordsService.getAnalysisStatus({ analysisId: "analysis" });
expect(publicStatus).toMatchObject({
	status: "failed",
	failureReason: "partial_results",
	keywordsCount: 84,
});
expect(publicStatus).not.toHaveProperty("error");
expect(JSON.stringify(logs)).toContain("partial-task");
expect(JSON.stringify(logs)).toContain("keyword-2");
expect(JSON.stringify(logs)).not.toContain("callback.test/secret");
console.log("Failure, retry, late callback, frontend reason and diagnostic checks passed");
