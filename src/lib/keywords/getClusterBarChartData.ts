import type { KeywordClusterAnalysis } from "$lib/server/clickhouse/services/keywords";

export type ClusterBarChartData = {
	name: string;
	totalVolume: number;
	clientVolume: number;
	comparisonVolume: number;
	clientShare: number;
	comparisonShare: number;
};

export function getClusterBarChartData({
	clusters,
	clientDomain,
	selectedDomains,
}: {
	clusters: Array<KeywordClusterAnalysis>;
	clientDomain: string;
	selectedDomains: Iterable<string>;
}): {
	data: Array<ClusterBarChartData>;
	comparisonDomain?: string;
} {
	const competitors = [...new Set(selectedDomains)].filter((domain) => domain !== clientDomain);
	const comparisonDomain = competitors.length === 1 ? competitors[0] : undefined;

	return {
		comparisonDomain,
		data: clusters.map((cluster) => {
			const clientVolume =
				cluster.domains.find(({ domain }) => domain === clientDomain)?.volume ?? 0;
			const comparisonVolume = comparisonDomain
				? (cluster.domains.find(({ domain }) => domain === comparisonDomain)?.volume ?? 0)
				: cluster.domains.reduce(
						(total, domain) => (domain.domain === clientDomain ? total : total + domain.volume),
						0,
					);
			const shareDivisor = cluster.totalVolume || 1;

			return {
				name: cluster.name,
				totalVolume: cluster.totalVolume,
				clientVolume,
				comparisonVolume,
				clientShare: (clientVolume / shareDivisor) * 100,
				comparisonShare: (comparisonVolume / shareDivisor) * 100,
			};
		}),
	};
}
