import type { ShareOfVoiceHistoryRow } from "./getShareOfVoiceSnapshot";

export function getShareOfVoiceHistory(
	data: ReadonlyArray<ShareOfVoiceHistoryRow>,
	domains: Iterable<string>,
): Array<Record<string, Date | number>> {
	const selected = new Set(domains);
	const rows = new Map<string, Record<string, Date | number>>();
	for (const item of data) {
		if (!Number.isFinite(new Date(item.createdAt).getTime())) continue;
		let row = rows.get(item.createdAt);
		if (!row) {
			row = Object.fromEntries([...selected].map((domain) => [domain, 0]));
			row.date = new Date(item.createdAt);
			rows.set(item.createdAt, row);
		}
		if (selected.has(item.domain)) {
			row[item.domain] = item.totalVolume > 0 ? 100 * item.volume / item.totalVolume : 0;
		}
	}
	return [...rows.values()].sort((a, b) => Number(a.date) - Number(b.date));
}
