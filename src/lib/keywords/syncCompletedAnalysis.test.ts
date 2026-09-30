import { expect, test } from "bun:test";
import { syncCompletedAnalysis } from "./syncCompletedAnalysis";

test("refreshes results when an analysis finishes entirely between polls", async () => {
	const refreshed: string[] = [];
	let lastId: string | undefined;
	for (const analysisId of ["first", "first", "after-import", "after-import"]) {
		lastId = await syncCompletedAnalysis(
			{ analysisId, status: "completed" }, lastId,
			async () => { refreshed.push(analysisId); },
		);
	}
	expect(refreshed).toEqual(["first", "after-import"]);
});

test("waits for completed results and retains the previous results on failure", async () => {
	let refreshCount = 0;
	let lastId: string | undefined = "previous";
	for (const status of [null, "pending", "failed", "completed"] as const) {
		lastId = await syncCompletedAnalysis(
			status ? { analysisId: "new", status } : null, lastId,
			async () => { refreshCount++; },
		);
		if (status !== "completed") expect(lastId).toBe("previous");
	}
	expect(refreshCount).toBe(1);
	expect(lastId).toBe("new");
});

test("retries a failed refresh on the next poll of the same completed analysis", async () => {
	const analysis = { analysisId: "new", status: "completed" } as const;
	let lastId: string | undefined = "previous";
	await expect((async () => {
		lastId = await syncCompletedAnalysis(analysis, lastId, async () => {
			throw new Error("Network unavailable");
		});
	})()).rejects.toThrow("Network unavailable");
	expect(lastId).toBe("previous");
	lastId = await syncCompletedAnalysis(analysis, lastId, async () => {});
	expect(lastId).toBe("new");
});
