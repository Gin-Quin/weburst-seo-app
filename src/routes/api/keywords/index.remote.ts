import { command, query } from "$app/server";
import { requireProjectAccess } from "$lib/server/auth/authorization";
import {
	KeywordsService,
	type KeywordAnalysisStatus,
} from "$lib/server/clickhouse/services/keywords";
import * as v from "valibot";
import { getRequestUser } from "../utilities";
import { AddKeywords } from "../keywords.schema";

export const addKeywords = command(AddKeywords, async ({ projectId, keywords, mode }) => {
	await requireProjectAccess(await getRequestUser(), projectId, "manage_keywords");
	await KeywordsService.addKeywords(projectId, keywords, mode);
});

export const hasKeywords = query(
	v.object({ projectId: v.string() }),
	async ({ projectId }): Promise<boolean> => {
		await requireProjectAccess(await getRequestUser(), projectId, "view");
		return KeywordsService.hasKeywords(projectId);
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
