import type { ClickHouseClient } from "@clickhouse/client";
import type { ClusterHistoryRow } from "$lib/keywords/getClusterHistory";

export type ReclassifiedClusterRow = ClusterHistoryRow & { cluster: string };

/** Join current labels to each crawl's own keywords, volumes and SERP responses. */
export async function getReclassifiedClusterRows(
	clickhouse: Pick<ClickHouseClient, "query">,
	input: { analysisIds: string[]; currentSetId: string; clusterNames?: string[] },
): Promise<ReclassifiedClusterRow[]> {
	if (input.analysisIds.length === 0) return [];
	const response = await clickhouse.query({
		query: `
			SELECT DISTINCT
				responses.analysisId AS analysisId,
				responses.keyword AS keyword,
				keywords.volume AS keywordVolume,
				trim(currentKeywords.clusters) AS cluster,
				responses.domain AS domain,
				responses.position AS position,
				responses.type AS type
			FROM keywordAnalysisResponses AS responses
			INNER JOIN keywordAnalysis AS analysis ON toString(analysis.id) = responses.analysisId
			INNER JOIN keywords ON keywords.setId = analysis.setId AND keywords.name = responses.keyword
			INNER JOIN keywords AS currentKeywords
				ON currentKeywords.setId = {currentSetId:UUID} AND currentKeywords.name = keywords.name
			WHERE analysis.id IN {analysisIds:Array(UUID)} AND responses.position <= 10
				AND notEmpty(trim(currentKeywords.clusters))
				${input.clusterNames?.length ? "AND trim(currentKeywords.clusters) IN {clusterNames:Array(String)}" : ""}
		`,
		query_params: input,
		format: "JSON",
	});
	return (await response.json<ReclassifiedClusterRow>()).data;
}
