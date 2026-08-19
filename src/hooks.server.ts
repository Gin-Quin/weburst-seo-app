import { building } from "$app/environment";
import { startRecurringTask } from "$lib/server/backgroundJobs";
import { KeywordsService } from "$lib/server/clickhouse/services/keywords";
import { HOUR, MINUTE } from "$lib/timeUnits";

type BackgroundJobs = {
	stop: () => void;
};

const runtime = globalThis as typeof globalThis & {
	__weburstBackgroundJobs?: BackgroundJobs;
};

if (!building) {
	// Re-evaluating this module in development must replace, not duplicate, jobs.
	runtime.__weburstBackgroundJobs?.stop();

	const stopAnalysisScheduler = startRecurringTask({
		name: "keyword analysis scheduler",
		intervalMs: HOUR,
		task: KeywordsService.startAllKeywordAnalysis,
	});
	const stopReadyTaskPoller = startRecurringTask({
		name: "DataForSEO ready task poller",
		intervalMs: 2 * MINUTE,
		task: KeywordsService.fetchTasksReady,
	});

	runtime.__weburstBackgroundJobs = {
		stop: () => {
			stopAnalysisScheduler();
			stopReadyTaskPoller();
		},
	};
}
