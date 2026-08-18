export type AnalysisTaskCounts = {
	keywordsCount: number;
	startedTasks: number;
	completedTasks: number;
	failedTasks: number;
};

/**
 * An analysis is terminal only when every expected keyword has a durable task
 * row and every task has a terminal status. Item rows are deliberately not part
 * of this decision because a valid result can contain zero items.
 */
export function hasEveryTaskFinished({
	keywordsCount,
	startedTasks,
	completedTasks,
	failedTasks,
}: AnalysisTaskCounts): boolean {
	return (
		keywordsCount > 0 &&
		startedTasks === keywordsCount &&
		completedTasks + failedTasks === keywordsCount
	);
}
