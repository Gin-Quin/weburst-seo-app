export function selectLatestAnalysisPerDay<T extends { createdAt: string }>(
	analyses: ReadonlyArray<T>,
): Array<T> {
	const latestAnalysisByDay = new Map<string, T>();

	for (const analysis of analyses) {
		const day = analysis.createdAt.slice(0, 10);
		const latestAnalysis = latestAnalysisByDay.get(day);

		if (!latestAnalysis || analysis.createdAt > latestAnalysis.createdAt) {
			latestAnalysisByDay.set(day, analysis);
		}
	}

	return [...latestAnalysisByDay.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
