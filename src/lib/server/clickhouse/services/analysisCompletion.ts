export type AnalysisTaskCounts = {
	keywordsCount: number;
	startedTasks: number;
	completedTasks: number;
	failedTasks: number;
};

/**
 * Every task has finished only when each expected keyword has a durable task
 * row and a terminal status. Item rows are deliberately not part
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

export function getAnalysisCompletionOutcome(
	counts: AnalysisTaskCounts,
): "pending" | "completed" | "failed" {
	if (!hasEveryTaskFinished(counts)) return "pending";
	return counts.completedTasks > 0 ? "completed" : "failed";
}
