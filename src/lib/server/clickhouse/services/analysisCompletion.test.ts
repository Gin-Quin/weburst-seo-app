import { describe, expect, test } from "bun:test";
import { hasEveryTaskFinished } from "./analysisCompletion";

describe("hasEveryTaskFinished", () => {
	test("finishes when every expected task has a terminal status", () => {
		expect(
			hasEveryTaskFinished({
				keywordsCount: 3,
				startedTasks: 3,
				completedTasks: 2,
				failedTasks: 1,
			}),
		).toBe(true);
	});

	test("does not finish when task registration lost an expected keyword", () => {
		expect(
			hasEveryTaskFinished({
				keywordsCount: 3,
				startedTasks: 2,
				completedTasks: 2,
				failedTasks: 0,
			}),
		).toBe(false);
	});

	test("does not infer completion from partial terminal results", () => {
		expect(
			hasEveryTaskFinished({
				keywordsCount: 3,
				startedTasks: 3,
				completedTasks: 1,
				failedTasks: 1,
			}),
		).toBe(false);
	});

	test("does not start an empty analysis", () => {
		expect(
			hasEveryTaskFinished({
				keywordsCount: 0,
				startedTasks: 0,
				completedTasks: 0,
				failedTasks: 0,
			}),
		).toBe(false);
	});
});
