export type ClusteredKeyword = {
	name: string;
	volume: number;
	clusters: string;
};

export type KeywordClusterSummary = {
	name: string;
	keywordCount: number;
	totalVolume: number;
};

/**
 * Build stable summaries for the user-provided cluster labels in a keyword set.
 * Keywords without a cluster are intentionally omitted from the summaries.
 */
export function getKeywordClusterSummaries(
	keywords: Iterable<ClusteredKeyword>,
): KeywordClusterSummary[] {
	const summaries = new Map<string, KeywordClusterSummary>();

	for (const keyword of keywords) {
		const name = keyword.clusters.trim();
		if (!name) continue;

		const summary = summaries.get(name) ?? {
			name,
			keywordCount: 0,
			totalVolume: 0,
		};
		summary.keywordCount += 1;
		summary.totalVolume += keyword.volume;
		summaries.set(name, summary);
	}

	return [...summaries.values()].sort(
		(a, b) => b.totalVolume - a.totalVolume || a.name.localeCompare(b.name),
	);
}
