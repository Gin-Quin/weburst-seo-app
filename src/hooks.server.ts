import { building } from "$app/environment";
import { env } from "$env/dynamic/private";
import { startRecurringTask } from "$lib/server/backgroundJobs";
import { KeywordsService } from "$lib/server/clickhouse/services/keywords";
import { HOUR, MINUTE } from "$lib/timeUnits";
import type { Handle, HandleServerError } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.requestStartedAt = performance.now();
	return resolve(event);
};

export const handleError: HandleServerError = ({ error, event, status, message }) => {
	const errorId = crypto.randomUUID();
	console.error("[server-request-error]", {
		errorId,
		timestamp: new Date().toISOString(),
		method: event.request.method,
		pathname: event.url.pathname,
		route: event.route.id,
		projectId: event.params.projectId,
		userId: event.locals.requestUserId,
		status,
		durationMs:
			event.locals.requestStartedAt === undefined
				? undefined
				: Math.round(performance.now() - event.locals.requestStartedAt),
		error,
	});
	// Keep internal errors server-side; the reference is also included in the
	// remote query error logged by the client for correlation.
	return { message, errorId };
};

type BackgroundJobs = {
	stop: () => Promise<void>;
};

const runtime = globalThis as typeof globalThis & {
	__weburstBackgroundJobs?: BackgroundJobs;
};

// Re-evaluating this module in development must always stop the previous jobs,
// including when background jobs have just been disabled.
if (!building && runtime.__weburstBackgroundJobs) {
	await runtime.__weburstBackgroundJobs.stop();
}

if (!building && env.RUN_BACKGROUND_JOBS === "true") {
	const analysisScheduler = startRecurringTask({
		name: "keyword analysis scheduler",
		intervalMs: HOUR,
		task: KeywordsService.startAllKeywordAnalysis,
	});
	const readyTaskPoller = startRecurringTask({
		name: "DataForSEO ready task poller",
		intervalMs: 2 * MINUTE,
		task: KeywordsService.fetchTasksReady,
	});

	let stopped = false;
	const stop = async () => {
		if (stopped) return;
		stopped = true;

		process.off("sveltekit:shutdown", handleShutdown);
		await Promise.all([analysisScheduler.stop(), readyTaskPoller.stop()]);
		if (runtime.__weburstBackgroundJobs?.stop === stop) {
			runtime.__weburstBackgroundJobs = undefined;
		}
	};

	const handleShutdown = (_reason: unknown, waitUntil?: (promise: Promise<unknown>) => void) => {
		const stopping = stop();
		waitUntil?.(stopping);
	};

	process.once("sveltekit:shutdown", handleShutdown);
	runtime.__weburstBackgroundJobs = { stop };
}
