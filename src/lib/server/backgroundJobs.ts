export type RecurringTaskOptions = {
	name: string;
	intervalMs: number;
	task: (signal: AbortSignal) => Promise<void>;
	initialDelayMs?: number;
	onError?: (error: unknown) => void;
	schedule?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
	cancel?: (timer: ReturnType<typeof setTimeout>) => void;
};

export type RecurringTask = {
	stop: () => Promise<void>;
};

/**
 * Run a background task repeatedly, waiting for each run to finish before the
 * next interval begins. Stopping aborts the active task and waits for it to
 * settle, so process shutdown cannot leave work half-owned by this runner.
 */
export function startRecurringTask({
	name,
	intervalMs,
	task,
	initialDelayMs = 0,
	onError = (error) => console.error(`Background task ${name} failed:`, error),
	schedule = setTimeout,
	cancel = clearTimeout,
}: RecurringTaskOptions): RecurringTask {
	const abortController = new AbortController();
	let stopped = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let currentRun: Promise<void> | undefined;

	const scheduleNext = (delayMs: number) => {
		if (stopped) return;
		timer = schedule(() => void run(), delayMs);
	};

	const run = async () => {
		if (stopped) return;

		const runPromise = task(abortController.signal);
		currentRun = runPromise;
		try {
			await runPromise;
		} catch (error) {
			if (!abortController.signal.aborted) onError(error);
		} finally {
			if (currentRun === runPromise) currentRun = undefined;
			scheduleNext(intervalMs);
		}
	};

	scheduleNext(initialDelayMs);

	return {
		stop: async () => {
			if (stopped) {
				await currentRun;
				return;
			}

			stopped = true;
			abortController.abort();
			if (timer !== undefined) cancel(timer);
			await currentRun;
		},
	};
}
