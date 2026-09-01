import { describe, expect, test } from "bun:test";
import { startRecurringTask } from "./backgroundJobs";

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("startRecurringTask", () => {
	test("does not schedule the next run until the current run finishes", async () => {
		const scheduled: Array<{ callback: () => void; delayMs: number }> = [];
		let finishTask: (() => void) | undefined;
		let runs = 0;

		const recurringTask = startRecurringTask({
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
		await recurringTask.stop();
	});

	test("reports failures and schedules another run", async () => {
		const scheduled: Array<{ callback: () => void; delayMs: number }> = [];
		const errors: unknown[] = [];

		const recurringTask = startRecurringTask({
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
		await recurringTask.stop();
	});

	test("cancels a pending run when stopped", async () => {
		const cancelled: ReturnType<typeof setTimeout>[] = [];
		const timer = 42 as unknown as ReturnType<typeof setTimeout>;

		const recurringTask = startRecurringTask({
			name: "test",
			intervalMs: 1_000,
			task: async () => undefined,
			schedule: () => timer,
			cancel: (pendingTimer) => cancelled.push(pendingTimer),
		});

		await recurringTask.stop();
		await recurringTask.stop();

		expect(cancelled).toEqual([timer]);
	});

	test("does not schedule another run when stopped during a task", async () => {
		const scheduled: Array<{ callback: () => void; delayMs: number }> = [];
		let finishTask: (() => void) | undefined;

		const recurringTask = startRecurringTask({
			name: "test",
			intervalMs: 1_000,
			task: () =>
				new Promise<void>((resolve) => {
					finishTask = resolve;
				}),
			schedule: (callback, delayMs) => {
				scheduled.push({ callback, delayMs });
				return 1 as unknown as ReturnType<typeof setTimeout>;
			},
			cancel: () => undefined,
		});

		scheduled.shift()!.callback();
		const stopping = recurringTask.stop();
		finishTask?.();
		await stopping;
		await flushPromises();

		expect(scheduled).toHaveLength(0);
	});

	test("aborts and waits for a running task when stopped", async () => {
		const scheduled: Array<() => void> = [];
		let observedAbort = false;

		const recurringTask = startRecurringTask({
			name: "test",
			intervalMs: 1_000,
			task: (signal) =>
				new Promise<void>((resolve) => {
					signal.addEventListener(
						"abort",
						() => {
							observedAbort = true;
							resolve();
						},
						{ once: true },
					);
				}),
			schedule: (callback) => {
				scheduled.push(callback);
				return 1 as unknown as ReturnType<typeof setTimeout>;
			},
			cancel: () => undefined,
		});

		scheduled.shift()!();
		await recurringTask.stop();

		expect(observedAbort).toBe(true);
		expect(scheduled).toHaveLength(0);
	});
});
