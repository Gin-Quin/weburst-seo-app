import { describe, expect, test } from "bun:test";
import { startRecurringTask } from "./backgroundJobs";

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("startRecurringTask", () => {
	test("does not schedule the next run until the current run finishes", async () => {
		const scheduled: Array<{ callback: () => void; delayMs: number }> = [];
		let finishTask: (() => void) | undefined;
		let runs = 0;

		const stop = startRecurringTask({
			name: "test",
			intervalMs: 1_000,
			task: () => {
				runs++;
				return new Promise<void>((resolve) => {
					finishTask = resolve;
				});
			},
			schedule: (callback, delayMs) => {
				scheduled.push({ callback, delayMs });
				return 1 as unknown as ReturnType<typeof setTimeout>;
			},
			cancel: () => undefined,
		});

		expect(scheduled.map(({ delayMs }) => delayMs)).toEqual([0]);
		scheduled.shift()!.callback();
		expect(runs).toBe(1);
		expect(scheduled).toHaveLength(0);

		finishTask?.();
		await flushPromises();
		expect(scheduled.map(({ delayMs }) => delayMs)).toEqual([1_000]);
		stop();
	});

	test("reports failures and schedules another run", async () => {
		const scheduled: Array<{ callback: () => void; delayMs: number }> = [];
		const errors: unknown[] = [];

		const stop = startRecurringTask({
			name: "test",
			intervalMs: 500,
			task: async () => {
				throw new Error("failure");
			},
			onError: (error) => errors.push(error),
			schedule: (callback, delayMs) => {
				scheduled.push({ callback, delayMs });
				return 1 as unknown as ReturnType<typeof setTimeout>;
			},
			cancel: () => undefined,
		});

		scheduled.shift()!.callback();
		await flushPromises();

		expect(errors).toHaveLength(1);
		expect(scheduled.map(({ delayMs }) => delayMs)).toEqual([500]);
		stop();
	});
});
