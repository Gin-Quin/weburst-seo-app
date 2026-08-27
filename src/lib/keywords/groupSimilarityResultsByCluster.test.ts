import { describe, expect, test } from "bun:test";
import { groupSimilarityResultsByCluster } from "./groupSimilarityResultsByCluster";

type Result = Array<{ keyword: string; clusters: string }>;

function result(keyword: string, clusters: string): Result {
	return [{ keyword, clusters }];
}

describe("groupSimilarityResultsByCluster", () => {
	test("groups results in configured cluster order and keeps unclustered results last", () => {
		const seoFirst = result("seo audit", "SEO");
		const unclustered = result("orphan", "");
		const content = result("content brief", "Content");
		const seoSecond = result("technical seo", "SEO");

		expect(
			groupSimilarityResultsByCluster(
				[seoFirst, unclustered, content, seoSecond],
				["Content", "SEO", "Unused"],
			),
		).toEqual([
			{ name: "Content", results: [content] },
			{ name: "SEO", results: [seoFirst, seoSecond] },
			{ name: null, results: [unclustered] },
		]);
	});

	test("keeps the flat result order when no clusters are configured", () => {
		const first = result("first", "");
		const second = result("second", "");

		expect(groupSimilarityResultsByCluster([first, second], [])).toEqual([
			{ name: null, results: [first, second] },
		]);
	});
});
