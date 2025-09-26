import type { AggregatedKeywordAnalysis, KeywordCluster } from "$lib/server/clickhouse/services/keywords";
import type { RemoteQuery } from "@sveltejs/kit";

export type ProjectContext = {
	analysisResultsWithTrendQuery?: RemoteQuery<AggregatedKeywordAnalysis | null>
	keywordClustersQuery?: RemoteQuery<KeywordCluster[] | null>
	openAddKeywordsDialog?: ({ afterAnalysis }?: { afterAnalysis?: () => void }) => void;
};

export const projectContext = $state<ProjectContext>({});
