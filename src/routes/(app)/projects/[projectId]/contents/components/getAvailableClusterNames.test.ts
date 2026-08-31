import { describe, expect, test } from "bun:test";
import type { KeywordCluster } from "$lib/server/clickhouse/services/keywords";
import { getAvailableClusterNames } from "./getAvailableClusterNames";

function keyword(keyword: string, clusters = ""): KeywordCluster[number] {
	return { keyword, clusters, volume: 0, items: [] };
}

describe("getAvailableClusterNames", () => {
	test("returns unique, trimmed cluster labels", () => {
		expect(
			getAvailableClusterNames([
				[keyword("technical seo", " SEO "), keyword("seo audit", "SEO")],
				[keyword("content brief", "Content")],
			]),
		).toEqual(["SEO", "Content"]);
	});

	test("does not fall back to keyword names when no cluster is available", () => {
		expect(
			getAvailableClusterNames([[keyword("technical seo"), keyword("seo audit", "   ")]]),
		).toEqual([]);
	});
});
