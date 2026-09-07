import { getDomainMetrics, type SerpAnalyticsRow } from "./serpAnalytics";
import type { ShareOfVoiceHistoryRow } from "$lib/charts/getShareOfVoiceSnapshot";

export type ClusterHistoryRow = SerpAnalyticsRow & { analysisId: string; keywordVolume: number };
export function getClusterHistory(
	analyses: Array<{ id: string; createdAt: string }>,
	rows: ClusterHistoryRow[],
	clientDomain: string,
): ShareOfVoiceHistoryRow[] {
	const grouped = new Map<string, ClusterHistoryRow[]>();
	for (const row of rows) {
		const group = grouped.get(row.analysisId) ?? [];
		group.push(row);
		grouped.set(row.analysisId, group);
	}
	return analyses.flatMap((analysis) => {
		const data = grouped.get(analysis.id) ?? [];
		const volumes = new Map(data.map((row) => [row.keyword, row.keywordVolume]));
		const metrics = getDomainMetrics(data, volumes);
		const totalVolume = metrics.reduce((total, row) => total + row.estimatedTraffic, 0);
		const result = metrics.map((row) => ({ createdAt: analysis.createdAt, domain: row.domain, volume: row.estimatedTraffic, totalVolume }));
		if (!result.some((row) => row.domain === clientDomain)) {
			result.push({ createdAt: analysis.createdAt, domain: clientDomain, volume: 0, totalVolume });
		}
		return result;
	});
}
