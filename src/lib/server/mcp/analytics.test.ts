import { describe, expect, test } from "bun:test";
import { formatKeywordSimilarityAnalysis, formatShareOfVoiceAnalysis } from "./analytics";

const project = { id: "project-1", name: "Project One", domain: "example.com" };

describe("MCP share-of-voice formatting", () => {
	test("returns ranked percentages, the project domain and bounded history", () => {
		const result = formatShareOfVoiceAnalysis({
			project,
			domainLimit: 1,
			historyPoints: 1,
			latest: {
				keywordCount: 12,
				totalVolume: 1_000,
				clusters: [
					{
						name: "CRM",
						keywordCount: 4,
						totalVolume: 400,
						domains: [
							{ domain: "competitor.test", volume: 200 },
							{ domain: "example.com", volume: 100 },
						],
					},
				],
				data: [
					{
						analysisId: "analysis-2",
						createdAt: "2026-08-20T10:00:00.000Z",
						domain: "competitor.test",
						volume: 500,
						topThreeKeywordCount: 8,
						topTenKeywordCount: 10,
						positionnedKeywordCount: 12,
						trend: 0.02,
					},
					{
						analysisId: "analysis-2",
						createdAt: "2026-08-20T10:00:00.000Z",
						domain: "example.com",
						volume: 250,
						topThreeKeywordCount: 3,
						topTenKeywordCount: 6,
						positionnedKeywordCount: 9,
						trend: 0.05,
					},
				],
			},
			history: [
				{
					createdAt: "2026-07-20T10:00:00.000Z",
					domain: "example.com",
					volume: 200,
					totalVolume: 1_000,
				},
				{
					createdAt: "2026-08-20T10:00:00.000Z",
					domain: "example.com",
					volume: 250,
					totalVolume: 1_000,
				},
			],
		});

		expect(result.status).toBe("ready");
		if (result.status !== "ready") throw new Error("Expected an analysis");
		expect(result.domains.map(({ domain }) => domain)).toEqual(["competitor.test", "example.com"]);
		expect(result.domains[1]).toMatchObject({
			shareOfVoicePercent: 25,
			trendPercentagePoints: 5,
		});
		expect(result.clusters[0]?.domains).toHaveLength(2);
		expect(result.history).toEqual([
			{
				analyzedAt: "2026-08-20T10:00:00.000Z",
				domains: [
					{
						domain: "example.com",
						weightedVisibilityVolume: 250,
						shareOfVoicePercent: 25,
					},
				],
			},
		]);
	});

	test("omits history when zero points are requested", () => {
		const result = formatShareOfVoiceAnalysis({
			project,
			domainLimit: 10,
			historyPoints: 0,
			latest: {
				keywordCount: 1,
				totalVolume: 100,
				clusters: [],
				data: [
					{
						analysisId: "analysis-1",
						createdAt: "2026-08-20T10:00:00.000Z",
						domain: "example.com",
						volume: 50,
						topThreeKeywordCount: 1,
						topTenKeywordCount: 1,
						positionnedKeywordCount: 1,
					},
				],
			},
			history: [
				{
					createdAt: "2026-08-20T10:00:00.000Z",
					domain: "example.com",
					volume: 50,
					totalVolume: 100,
				},
			],
		});

		expect(result.status).toBe("ready");
		if (result.status !== "ready") throw new Error("Expected an analysis");
		expect(result.history).toEqual([]);
	});
});

describe("MCP keyword-similarity formatting", () => {
	test("paginates clusters and includes bounded SERP evidence on demand", () => {
		const clusters = ["one", "two", "three"].map((keyword, index) => [
			{
				keyword,
				volume: 100 - index,
				clusters: "",
				items: [
					{ domain: "example.com", url: `https://example.com/${keyword}`, position: 1 },
					{ domain: "other.test", url: `https://other.test/${keyword}`, position: 2 },
				],
			},
		]);
		const result = formatKeywordSimilarityAnalysis({
			project,
			clusters,
			analysis: { id: "analysis-3", createdAt: "2026-08-20T10:00:00.000Z" },
			clusterOffset: 1,
			clusterLimit: 1,
			includeSerpPages: true,
			serpPageLimit: 1,
		});

		expect(result.status).toBe("ready");
		if (result.status !== "ready") throw new Error("Expected an analysis");
		expect(result.pagination).toEqual({ offset: 1, limit: 1, returned: 1, hasMore: true });
		expect(result.analysis).toEqual({
			id: "analysis-3",
			analyzedAt: "2026-08-20T10:00:00.000Z",
		});
		expect(result.clusters[0]).toMatchObject({ rank: 2, mainKeyword: "two" });
		expect(result.clusters[0]?.keywords[0]?.positionedPages).toHaveLength(1);
	});
});
