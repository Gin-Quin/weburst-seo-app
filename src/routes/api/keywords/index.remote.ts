import { command, query } from "$app/server";
import {
	KeywordsService,
	type KeywordAnalysisStatus,
} from "$lib/server/clickhouse/services/keywords";
import * as v from "valibot";

export const addKeywords = command(
	v.object({
		projectId: v.string(),
		keywords: v.array(v.tuple([v.string(), v.number()])),
	}),
	async ({ projectId, keywords }) => {
		await KeywordsService.addKeywords(projectId, keywords);
	},
);

export const startKeywordAnalysis = command(
	v.object({
		projectId: v.string(),
	}),
	async ({ projectId }) => {
		await KeywordsService.startKeywordAnalysis(projectId);
	},
);

export const getAnalysisStatus = command(
	v.object({
		projectId: v.string(),
	}),
	async ({ projectId }): Promise<KeywordAnalysisStatus | null> => {
		const analysisId = await KeywordsService.getProjectLastAnalysisId({
			projectId,
			status: null,
		});
		if (analysisId === null) {
			return null;
		}
		return await KeywordsService.getAnalysisStatus({ analysisId });
	},
);

export const getAnalysisResultsWithTrend = query(
	v.object({ projectId: v.string() }),
	async ({ projectId }) => {
		return await KeywordsService.getProjectLatestAggregatedAnalysisResults({ projectId });
	},
);

export const getAllAggregatedAnalysisResults = query(
	v.object({
		projectId: v.string(),
	}),
	async ({ projectId }) => {
		return await KeywordsService.getAllAggregatedAnalysisResults({ projectId, limit: 100 });
	},
);

export const getKeywordClusters = query(
	v.object({
		projectId: v.string(),
	}),
	async ({ projectId }) => {
		return await KeywordsService.getKeywordClusters({ projectId });
	},
);
