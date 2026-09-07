import type { ShareOfVoiceHistoryRow } from "./getShareOfVoiceSnapshot";

export function ensureClientHistory(
	rows: ShareOfVoiceHistoryRow[],
	analyses: Array<{ createdAt: string }>,
	clientDomain: string,
): ShareOfVoiceHistoryRow[] {
	const clientDates = new Set(rows.filter((row) => row.domain === clientDomain).map((row) => row.createdAt));
	const totalsByDate = new Map(rows.map((row) => [row.createdAt, row.totalVolume]));
	return [...rows, ...analyses.filter((analysis) => !clientDates.has(analysis.createdAt)).map((analysis) => ({
		createdAt: analysis.createdAt, domain: clientDomain, volume: 0,
		totalVolume: totalsByDate.get(analysis.createdAt) ?? 0,
	}))].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.domain.localeCompare(b.domain));
}
