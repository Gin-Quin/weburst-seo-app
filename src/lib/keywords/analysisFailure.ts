export type AnalysisFailureReason = "partial_results" | "analysis_failed";

/** Provider messages stay server-side; the browser receives a stable, safe reason. */
export function getAnalysisFailureReason(error: string): AnalysisFailureReason {
	return /(?:^|\n)40106:/.test(error) ? "partial_results" : "analysis_failed";
}
