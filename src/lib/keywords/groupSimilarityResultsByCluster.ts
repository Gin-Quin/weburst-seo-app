type ClusteredSimilarityResult = readonly { clusters: string }[];

export type SimilarityResultGroup<T extends ClusteredSimilarityResult> = {
	name: string | null;
	results: T[];
};

export function groupSimilarityResultsByCluster<T extends ClusteredSimilarityResult>(
	results: readonly T[],
	clusterNames: readonly string[],
): SimilarityResultGroup<T>[] {
	if (clusterNames.length === 0) {
		return [{ name: null, results: [...results] }];
	}

	const resultsByCluster = new Map<string, T[]>();
	for (const clusterName of clusterNames) {
		resultsByCluster.set(clusterName, []);
	}

	const unclusteredResults: T[] = [];
	for (const result of results) {
		const clusterName = result[0]?.clusters.trim();
		if (!clusterName) {
			unclusteredResults.push(result);
			continue;
		}

		const clusterResults = resultsByCluster.get(clusterName) ?? [];
		clusterResults.push(result);
		resultsByCluster.set(clusterName, clusterResults);
	}

	const groups: SimilarityResultGroup<T>[] = [...resultsByCluster].flatMap(
		([name, clusterResults]) =>
			clusterResults.length > 0 ? [{ name, results: clusterResults }] : [],
	);

	if (unclusteredResults.length > 0) {
		groups.push({ name: null, results: unclusteredResults });
	}

	return groups;
}
