import { KeywordsService } from "$lib/server/clickhouse/services/keywords";
import { DAY, MINUTE } from "$lib/timeUnits";

const timeUntil23PM = () => {
	const now = new Date();
	const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23);
	return target.getTime() - now.getTime();
};

setTimeout(() => {
	KeywordsService.startAllKeywordAnalysis();
	setInterval(KeywordsService.startAllKeywordAnalysis, 1 * DAY);
}, timeUntil23PM());

setInterval(KeywordsService.fetchTasksReady, 2 * MINUTE);
