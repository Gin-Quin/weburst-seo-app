import type { KeywordCluster } from "$lib/server/clickhouse/services/keywords";

export function getAvailableClusterNames(clusters: KeywordCluster[] | null): string[] {
	return [
		...new Set(
			(clusters ?? [])
				.flatMap((group) => group.map(({ clusters }) => clusters.trim()))
				.filter(Boolean),
		),
	];
}
