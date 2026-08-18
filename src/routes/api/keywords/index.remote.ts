import { command, query } from "$app/server";
import { requireProjectAccess } from "$lib/server/auth/authorization";
import {
	KeywordsService,
	type KeywordAnalysisStatus,
} from "$lib/server/clickhouse/services/keywords";
import * as v from "valibot";
import { getRequestUser } from "../utilities";

export const addKeywords = command(
	v.object({
		projectId: v.string(),
		keywords: v.array(v.tuple([v.string(), v.number()])),
	}),
	async ({ projectId, keywords }) => {
		await requireProjectAccess(await getRequestUser(), projectId, "manage_keywords");
		await KeywordsService.addKeywords(projectId, keywords);
	},
);

export const startKeywordAnalysis = command(
	v.object({
		projectId: v.string(),
	}),
	async ({ projectId }) => {
		await requireProjectAccess(await getRequestUser(), projectId, "manage_keywords");
		await KeywordsService.startKeywordAnalysis(projectId);
	},
);

export const getAnalysisStatus = command(
	v.object({
		projectId: v.string(),
	}),
	async ({ projectId }): Promise<KeywordAnalysisStatus | null> => {
		await requireProjectAccess(await getRequestUser(), projectId, "view");
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
		await requireProjectAccess(await getRequestUser(), projectId, "view");
		return await KeywordsService.getProjectLatestAggregatedAnalysisResults({ projectId });
	},
);

export const getAllAggregatedAnalysisResults = query(
	v.object({
		projectId: v.string(),
	}),
	async ({ projectId }) => {
		await requireProjectAccess(await getRequestUser(), projectId, "view");
		return await KeywordsService.getAllAggregatedAnalysisResults({
			projectId,
			domainLimit: 100,
		});
	},
);

export const getKeywordClusters = query(
	v.object({
		projectId: v.string(),
	}),
	async ({ projectId }) => {
		await requireProjectAccess(await getRequestUser(), projectId, "view");
		return await KeywordsService.getKeywordClusters({ projectId });
	},
);
