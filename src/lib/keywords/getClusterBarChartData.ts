import type { KeywordClusterAnalysis } from "$lib/server/clickhouse/services/keywords";

export type ClusterBarChartData = {
	name: string;
	totalVolume: number;
	clientVolume: number;
	comparisonVolume: number;
	comparisonDomain?: string;
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
	const selectedCompetitors = new Set(competitors);

	return {
		comparisonDomain,
		data: clusters.map((cluster) => {
			const clientVolume =
				cluster.domains.find(({ domain }) => domain === clientDomain)?.volume ?? 0;
			const strongestCompetitor = cluster.domains
				.filter(({ domain }) => domain !== clientDomain &&
					(selectedCompetitors.size === 0 || selectedCompetitors.has(domain)))
				.sort((a, b) => b.volume - a.volume || a.domain.localeCompare(b.domain))[0];
			const comparisonVolume = strongestCompetitor?.volume ?? 0;
			const shareDivisor = cluster.totalTraffic || 1;

			return {
				name: cluster.name,
				totalVolume: cluster.totalVolume,
				clientVolume,
				comparisonVolume,
				comparisonDomain: strongestCompetitor?.domain,
				clientShare: (clientVolume / shareDivisor) * 100,
				comparisonShare: (comparisonVolume / shareDivisor) * 100,
			};
		}),
	};
}
