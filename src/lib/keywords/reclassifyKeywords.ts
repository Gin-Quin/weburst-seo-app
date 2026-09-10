import { getKeywordClusterSummaries, type ClusteredKeyword } from "./getKeywordClusterSummaries";

/** Use today's labels without changing the historical population or volumes. */
export function reclassifyKeywords(
	historicalKeywords: Iterable<ClusteredKeyword>,
	currentKeywords: ReadonlyMap<string, ClusteredKeyword>,
): Map<string, ClusteredKeyword> {
	return new Map(
		Array.from(historicalKeywords, (keyword) => [
			keyword.name,
			{ ...keyword, clusters: currentKeywords.get(keyword.name)?.clusters.trim() ?? "" },
		]),
	);
}

export function getReclassifiedClusterSummaries(
	reclassifiedKeywords: Iterable<ClusteredKeyword>,
	currentKeywords: Iterable<ClusteredKeyword>,
) {
	const summaries = new Map(
		getKeywordClusterSummaries(reclassifiedKeywords).map((summary) => [summary.name, summary]),
	);
	// Keep current clusters selectable even when absent from the latest crawl:
	// they may have results in earlier crawls, or be awaiting their first analysis.
	for (const keyword of currentKeywords) {
		const name = keyword.clusters.trim();
		if (name && !summaries.has(name)) {
			summaries.set(name, { name, keywordCount: 0, totalVolume: 0 });
		}
	}
	return [...summaries.values()].sort(
		(a, b) => b.totalVolume - a.totalVolume || a.name.localeCompare(b.name),
	);
}
