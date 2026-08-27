import { getSimilarity } from "$lib/numbers/getSimilarity";

export type PivotKeyword = {
	keyword: string;
	volume: number;
	urls: Set<string>;
};

/**
 * Cluster keywords around volume-ordered pivots, then attach every non-pivot
 * keyword to the directly similar pivot with the highest Dice score.
 */
export function getPivotClusters(keywords: Iterable<PivotKeyword>, threshold: number): string[][] {
	const values = [...keywords].sort(compareKeywords);
	const byKeyword = new Map(values.map((value) => [value.keyword, value]));
	const assigned = new Set<string>();
	const pivots: string[] = [];

	// Pass 1 deliberately mirrors the Python greedy pivot selection.
	for (const candidate of values) {
		if (assigned.has(candidate.keyword)) continue;

		pivots.push(candidate.keyword);
		assigned.add(candidate.keyword);
		if (candidate.urls.size === 0) continue;

		for (const other of values) {
			if (assigned.has(other.keyword) || other.urls.size === 0) continue;
			if (getSimilarity(candidate.urls, other.urls) >= threshold) {
				assigned.add(other.keyword);
			}
		}
	}

	// Pass 2 picks the best eligible pivot instead of the first eligible pivot.
	const clustersByPivot = new Map(pivots.map((pivot) => [pivot, [pivot]]));
	const pivotSet = new Set(pivots);
	const activePivots = pivots.filter((pivot) => byKeyword.get(pivot)!.urls.size > 0);

	for (const candidate of values) {
		if (pivotSet.has(candidate.keyword) || candidate.urls.size === 0) continue;

		let bestPivot: PivotKeyword | undefined;
		let bestSimilarity = -1;
		for (const pivotName of activePivots) {
			const pivot = byKeyword.get(pivotName)!;
			const similarity = getSimilarity(pivot.urls, candidate.urls);
			if (similarity < threshold) continue;

			if (
				similarity > bestSimilarity ||
				(similarity === bestSimilarity &&
					bestPivot !== undefined &&
					compareKeywords(pivot, bestPivot) < 0)
			) {
				bestPivot = pivot;
				bestSimilarity = similarity;
			}
		}

		if (bestPivot) clustersByPivot.get(bestPivot.keyword)!.push(candidate.keyword);
	}

	return pivots.map((pivot) => clustersByPivot.get(pivot)!);
}

function compareKeywords(
	a: Pick<PivotKeyword, "keyword" | "volume">,
	b: Pick<PivotKeyword, "keyword" | "volume">,
) {
	return b.volume - a.volume || a.keyword.localeCompare(b.keyword);
}
