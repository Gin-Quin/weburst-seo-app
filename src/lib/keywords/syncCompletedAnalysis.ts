import type { KeywordAnalysisStatus } from "$lib/server/clickhouse/services/keywords";

type AnalysisStatus = Pick<KeywordAnalysisStatus, "analysisId" | "status">;

/** Only acknowledge a completed analysis after its results have been refreshed. */
export async function syncCompletedAnalysis(
	analysis: AnalysisStatus | null,
	lastRefreshedId: string | undefined,
	refresh: () => Promise<unknown>,
): Promise<string | undefined> {
	if (analysis?.status !== "completed" || analysis.analysisId === lastRefreshedId) {
		return lastRefreshedId;
	}

	await refresh();
	return analysis.analysisId;
}
