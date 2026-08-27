import { extractHost } from "$lib/keywords/serpAnalytics";

type ProjectReference = {
	id: string;
	name: string;
	domain: string;
};

type ShareOfVoiceRow = {
	analysisId: string;
	createdAt: string;
	domain: string;
	volume: number;
	topThreeKeywordCount: number;
	topTenKeywordCount: number;
	positionnedKeywordCount: number;
	trend?: number;
};

type ShareOfVoiceCluster = {
	name: string;
	keywordCount: number;
	totalVolume: number;
	totalTraffic: number;
	domains: Array<{ domain: string; volume: number }>;
};

type ShareOfVoiceAnalysis = {
	keywordCount: number;
	totalVolume: number;
	totalTraffic: number;
	clusters: ShareOfVoiceCluster[];
	data: ShareOfVoiceRow[];
};

type ShareOfVoiceHistoryRow = Pick<ShareOfVoiceRow, "createdAt" | "domain" | "volume"> & {
	totalVolume: number;
};

type SimilarityClusterItem = {
	keyword: string;
	volume: number;
	clusters: string;
	items: Array<{ domain: string; url: string; position: number }>;
};

export function formatShareOfVoiceAnalysis({
	project,
	latest,
	history,
	domainLimit,
	historyPoints,
}: {
	project: ProjectReference;
	latest: ShareOfVoiceAnalysis | null;
	history: ShareOfVoiceHistoryRow[];
	domainLimit: number;
	historyPoints: number;
}) {
	if (!latest || latest.data.length === 0) {
		return {
			project,
			status: "no_analysis" as const,
			message: "No completed share-of-voice analysis is available for this project.",
		};
	}

	const projectDomain = extractHost(project.domain);
	const selectedLatestRows = selectDomains(latest.data, projectDomain, domainLimit, () => ({
		...latest.data[0]!,
		domain: projectDomain,
		volume: 0,
		topThreeKeywordCount: 0,
		topTenKeywordCount: 0,
		positionnedKeywordCount: 0,
		trend: undefined,
	}));
	const selectedDomains = new Set(selectedLatestRows.map(({ domain }) => domain));
	const historyDates =
		historyPoints === 0
			? []
			: [...new Set(history.map(({ createdAt }) => createdAt))]
					.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
					.slice(-historyPoints);
	const historyDateSet = new Set(historyDates);
	const historyByDate = new Map<
		string,
		Array<{
			domain: string;
			estimatedTraffic: number;
			weightedVisibilityVolume: number;
			shareOfVoicePercent: number;
		}>
	>();
	for (const row of history) {
		if (!selectedDomains.has(row.domain) || !historyDateSet.has(row.createdAt)) continue;
		const entries = historyByDate.get(row.createdAt) ?? [];
		entries.push({
			domain: row.domain,
			estimatedTraffic: row.volume,
			weightedVisibilityVolume: row.volume,
			shareOfVoicePercent: toPercent(row.volume, row.totalVolume),
		});
		historyByDate.set(row.createdAt, entries);
	}

	return {
		project,
		status: "ready" as const,
		methodology: {
			shareOfVoice:
				"Estimated organic traffic divided by the estimated traffic of all top-10 domains.",
			trend: "Percentage-point change versus the reference analysis from about one month earlier.",
		},
		analysis: {
			id: latest.data[0]!.analysisId,
			analyzedAt: latest.data[0]!.createdAt,
			keywordCount: latest.keywordCount,
			totalSearchVolume: latest.totalVolume,
		},
		domains: selectedLatestRows.map((row) => ({
			rank: latest.data.findIndex(({ domain }) => domain === row.domain) + 1 || null,
			domain: row.domain,
			isProjectDomain: row.domain === projectDomain,
			estimatedTraffic: row.volume,
			weightedVisibilityVolume: row.volume,
			shareOfVoicePercent: toPercent(row.volume, latest.totalTraffic),
			trendPercentagePoints: row.trend === undefined ? null : round(row.trend * 100),
			positionedKeywordCount: row.positionnedKeywordCount,
			topTenKeywordCount: row.topTenKeywordCount,
			topThreeKeywordCount: row.topThreeKeywordCount,
		})),
		clusters: latest.clusters.map((cluster) => ({
			name: cluster.name,
			keywordCount: cluster.keywordCount,
			totalSearchVolume: cluster.totalVolume,
			domains: selectDomains(cluster.domains, projectDomain, domainLimit, () => ({
				domain: projectDomain,
				volume: 0,
			})).map((row) => ({
				domain: row.domain,
				isProjectDomain: row.domain === projectDomain,
				estimatedTraffic: row.volume,
				weightedVisibilityVolume: row.volume,
				shareOfVoicePercent: toPercent(row.volume, cluster.totalTraffic),
			})),
		})),
		history: historyDates.map((analyzedAt) => ({
			analyzedAt,
			domains: historyByDate.get(analyzedAt) ?? [],
		})),
	};
}

export function formatKeywordSimilarityAnalysis({
	project,
	clusters,
	analysis,
	clusterOffset,
	clusterLimit,
	includeSerpPages,
	serpPageLimit,
}: {
	project: ProjectReference;
	clusters: SimilarityClusterItem[][] | null;
	analysis: { id: string; createdAt: string } | null;
	clusterOffset: number;
	clusterLimit: number;
	includeSerpPages: boolean;
	serpPageLimit: number;
}) {
	if (!clusters) {
		return {
			project,
			status: "no_analysis" as const,
			message: "No completed keyword-similarity analysis is available for this project.",
		};
	}

	const selectedClusters = clusters.slice(clusterOffset, clusterOffset + clusterLimit);
	return {
		project,
		status: "ready" as const,
		methodology: {
			serpDepth: 12,
			similarityThresholdPercent: 50,
			formula: "Sørensen–Dice coefficient over normalized top-12 organic SERP URLs.",
			grouping:
				"Volume-ordered pivots define clusters, then each keyword is attached to its most similar eligible pivot.",
		},
		analysis: analysis ? { id: analysis.id, analyzedAt: analysis.createdAt } : null,
		clusterCount: clusters.length,
		keywordCount: clusters.reduce((total, cluster) => total + cluster.length, 0),
		pagination: {
			offset: clusterOffset,
			limit: clusterLimit,
			returned: selectedClusters.length,
			hasMore: clusterOffset + selectedClusters.length < clusters.length,
		},
		clusters: selectedClusters.map((cluster, index) => ({
			rank: clusterOffset + index + 1,
			mainKeyword: cluster[0]?.keyword ?? null,
			keywordCount: cluster.length,
			totalSearchVolume: cluster.reduce((total, item) => total + item.volume, 0),
			keywords: cluster.map((item) => ({
				keyword: item.keyword,
				searchVolume: item.volume,
				configuredCluster: item.clusters || null,
				...(includeSerpPages ? { positionedPages: item.items.slice(0, serpPageLimit) } : {}),
			})),
		})),
	};
}

function selectDomains<T extends { domain: string }>(
	rows: T[],
	projectDomain: string,
	limit: number,
	createProjectFallback?: () => T,
): T[] {
	const selected = rows.slice(0, limit);
	const projectRow =
		rows.find(({ domain }) => domain === projectDomain) ?? createProjectFallback?.();
	if (projectRow && !selected.some(({ domain }) => domain === projectDomain)) {
		selected.push(projectRow);
	}
	return selected;
}

function toPercent(value: number, total: number): number {
	return total > 0 ? round((value / total) * 100) : 0;
}

function round(value: number): number {
	return Math.round(value * 10_000) / 10_000;
}
