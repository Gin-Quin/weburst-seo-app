import { expect, test } from "bun:test";
import { excludeFailedKeywords } from "./excludeFailedKeywords";
import { getDomainMetrics } from "./serpAnalytics";
import { getKeywordClusterSummaries } from "./getKeywordClusterSummaries";

test("excludes failures from traffic, rankings, cluster counts and search volume without changing the set", () => {
	const keywords = new Map([
		["successful", { name: "successful", volume: 100, clusters: "Tools" }],
		["empty-success", { name: "empty-success", volume: 200, clusters: "Tools" }],
		["failed", { name: "failed", volume: 10000, clusters: "Tools" }],
	]);
	const usable = excludeFailedKeywords(keywords, ["failed"]);
	expect(keywords.size).toBe(3);
	expect(getKeywordClusterSummaries(usable.values())).toEqual([
		{ name: "Tools", keywordCount: 2, totalVolume: 300 },
	]);
	const rows = ["successful", "failed"].map((keyword) => ({
		keyword,
		domain: "example.com",
		position: 1,
		type: "organic",
	}));
	expect(
		getDomainMetrics(rows, new Map([...usable].map(([name, item]) => [name, item.volume]))),
	).toEqual([
		{
			domain: "example.com",
			estimatedTraffic: 20,
			topThreeKeywordCount: 1,
			topTenKeywordCount: 1,
			positionedKeywordCount: 1,
		},
	]);
	expect(
		getDomainMetrics(rows, excludeFailedKeywords(new Map([["failed", 10000]]), ["failed"])),
	).toEqual([]);
});
