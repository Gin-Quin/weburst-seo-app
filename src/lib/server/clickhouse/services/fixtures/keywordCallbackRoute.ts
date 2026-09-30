// Run in a separate Bun process to keep module mocks out of the other tests.
import { expect, mock } from "bun:test";
import { gzipSync } from "bun";

const knownTasks = new Map<string, string>();
const saved: Array<{ analysisId: string; result: any }> = [];
let lookups = 0;
let appearAtLookup = Infinity;
let failSave = false;
mock.module("$lib/server/clickhouse/services/keywords", () => ({
	KeywordsService: {
		async getAnalysisIdFromTaskId({ taskId }: { taskId: string }) {
			lookups++;
			if (lookups >= appearAtLookup) knownTasks.set(taskId, "late-analysis");
			return knownTasks.get(taskId) ?? null;
		},
		async saveKeywordAnalysisResult(input: { analysisId: string; result: any }) {
			if (failSave) throw new Error("Temporary database failure");
			saved.push(input);
		},
	},
}));
const logs: unknown[][] = [];
const warnings: unknown[][] = [];
console.log = (...args) => void logs.push(args);
console.warn = (...args) => void warnings.push(args);
const { POST, GET } = await import("../../../../../routes/api/keywords/callback/+server");

const callback = (body: unknown, raw = false) =>
	(POST as any)({
		request: new Request("http://localhost/api/keywords/callback", {
			method: "POST",
			body: raw ? (body as string) : gzipSync(JSON.stringify(body)),
		}),
	}) as Promise<Response>;
const reset = () => {
	lookups = 0;
	appearAtLookup = Infinity;
	failSave = false;
	saved.length = 0;
	logs.length = 0;
	warnings.length = 0;
};

// A known task is saved and acknowledged with a 2xx, so DataForSEO marks it delivered.
knownTasks.set("task-1", "analysis-1");
const body = { tasks: [{ id: "task-1" }] };
const accepted = await callback(body);
expect(accepted.status).toBe(200);
expect(await accepted.text()).toBe("OK");
expect(saved).toEqual([{ analysisId: "analysis-1", result: body }]);
expect(lookups).toBe(1);
// The latency breakdown used to judge the 10 second postback limit is logged.
const [label, timing] = logs.find(([name]) => name === "[dataforseo-callback]")!;
expect(label).toBe("[dataforseo-callback]");
expect(timing).toMatchObject({ taskId: "task-1", lookupAttempts: 1 });
for (const key of ["parseMs", "lookupMs", "saveMs", "totalMs"]) {
	expect(typeof (timing as any)[key]).toBe("number");
}

// The task is resolved from the first entry only, and the whole payload is saved.
reset();
knownTasks.set("first", "analysis-2");
const batch = { tasks: [{ id: "first" }, { id: "second" }] };
expect((await callback(batch)).status).toBe(200);
expect(saved).toEqual([{ analysisId: "analysis-2", result: batch }]);

// The task row can be inserted just after the callback arrives: wait for it.
reset();
appearAtLookup = 3;
const racing = await callback({ tasks: [{ id: "racing" }] });
expect(racing.status).toBe(200);
expect(saved[0]).toMatchObject({ analysisId: "late-analysis" });
expect(lookups).toBe(3);
expect(logs.find(([name]) => name === "[dataforseo-callback]")![1]).toMatchObject({ lookupAttempts: 3 });

// A task that never resolves is refused with a non-2xx status: a 2xx would mark it delivered,
// it would never be listed in tasks_ready, and its result would stay lost.
reset();
const startedAt = Date.now();
const unknown = await callback({ tasks: [{ id: "unknown-task" }] });
expect(unknown.status).toBe(503);
expect(lookups).toBe(5);
expect(Date.now() - startedAt).toBeGreaterThanOrEqual(2000);
expect(saved).toHaveLength(0);
expect(JSON.stringify(warnings)).toContain("unknown-task");

// Payloads without tasks are acknowledged and never reach the database.
reset();
for (const empty of [{ tasks: [] }, {}, { status_code: 40000 }]) {
	const response = await callback(empty);
	expect(response.status).toBe(200);
}
expect(lookups).toBe(0);
expect(saved).toHaveLength(0);

// A failing save must surface as a server error so DataForSEO lists the task in tasks_ready.
reset();
failSave = true;
await expect(callback(body)).rejects.toThrow("Temporary database failure");

// A body that is not gzip-compressed JSON is never acknowledged as delivered.
reset();
await expect(callback('{"tasks":[]}', true)).rejects.toThrow();
expect(saved).toHaveLength(0);

expect(await (await (GET as any)({})).text()).toBe("OK");
process.stdout.write("Callback acknowledgement, race, rejection and failure checks passed\n");
