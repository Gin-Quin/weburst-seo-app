export type RecurringTaskOptions = {
	name: string;
	intervalMs: number;
	task: () => Promise<void>;
	initialDelayMs?: number;
	onError?: (error: unknown) => void;
	schedule?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
	cancel?: (timer: ReturnType<typeof setTimeout>) => void;
};

/**
 * Run a background task repeatedly, waiting for each run to finish before the
 * next interval begins. The returned function permanently stops the runner.
 */
export function startRecurringTask({
	name,
	intervalMs,
	task,
	initialDelayMs = 0,
	onError = (error) => console.error(`Background task ${name} failed:`, error),
	schedule = setTimeout,
	cancel = clearTimeout,
}: RecurringTaskOptions): () => void {
	let stopped = false;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const scheduleNext = (delayMs: number) => {
		if (stopped) return;
		timer = schedule(() => void run(), delayMs);
	};

	const run = async () => {
		try {
			await task();
		} catch (error) {
			onError(error);
		} finally {
			scheduleNext(intervalMs);
		}
	};

	scheduleNext(initialDelayMs);

	return () => {
		if (stopped) return;
		stopped = true;
		if (timer !== undefined) cancel(timer);
	};
}
