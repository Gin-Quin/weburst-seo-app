import { describe, expect, test } from "bun:test";
import { getKeywordClusterSummaries } from "./getKeywordClusterSummaries";

describe("getKeywordClusterSummaries", () => {
	test("groups keywords by their cluster and totals their volumes", () => {
		expect(
			getKeywordClusterSummaries([
				{ name: "technical seo", volume: 100, clusters: "SEO" },
				{ name: "seo audit", volume: 250, clusters: "SEO" },
				{ name: "content brief", volume: 500, clusters: "Content" },
			]),
		).toEqual([
			{ name: "Content", keywordCount: 1, totalVolume: 500 },
			{ name: "SEO", keywordCount: 2, totalVolume: 350 },
		]);
	});

	test("omits blank clusters and trims labels", () => {
		expect(
			getKeywordClusterSummaries([
				{ name: "one", volume: 10, clusters: "  Group A  " },
				{ name: "two", volume: 20, clusters: "" },
				{ name: "three", volume: 30, clusters: "   " },
			]),
		).toEqual([{ name: "Group A", keywordCount: 1, totalVolume: 10 }]);
	});

	test("uses the cluster name to break equal-volume ties", () => {
		expect(
			getKeywordClusterSummaries([
				{ name: "one", volume: 10, clusters: "Zebra" },
				{ name: "two", volume: 10, clusters: "Alpha" },
			]),
		).toEqual([
			{ name: "Alpha", keywordCount: 1, totalVolume: 10 },
			{ name: "Zebra", keywordCount: 1, totalVolume: 10 },
		]);
	});
});
