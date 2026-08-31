export type ShareOfVoiceHistoryRow = {
	createdAt: string;
	domain: string;
	volume: number;
	totalVolume: number;
};

export type ShareOfVoiceSnapshotItem = {
	domain: string;
	share: number;
};

export function countShareOfVoiceAnalyses(
	data: Iterable<Pick<ShareOfVoiceHistoryRow, "createdAt">>,
): number {
	return new Set([...data].map(({ createdAt }) => createdAt)).size;
}

export function getShareOfVoiceSnapshot({
	data,
	selectedDomains,
}: {
	data: Iterable<ShareOfVoiceHistoryRow>;
	selectedDomains: Iterable<string>;
}): Array<ShareOfVoiceSnapshotItem> {
	const rows = [...data];
	const latestCreatedAt = rows.reduce<string | undefined>(
		(latest, { createdAt }) => (latest === undefined || createdAt > latest ? createdAt : latest),
		undefined,
	);
	const latestRows = rows.filter(({ createdAt }) => createdAt === latestCreatedAt);
	const totalVolume = latestRows[0]?.totalVolume ?? 0;
	const volumeByDomain = new Map(latestRows.map(({ domain, volume }) => [domain, volume]));

	return [...new Set(selectedDomains)].map((domain) => ({
		domain,
		share: (volumeByDomain.get(domain) ?? 0) / (totalVolume || 1),
	}));
}
