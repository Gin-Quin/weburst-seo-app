import { describe, expect, test } from "bun:test";
import { getPivotClusters, type PivotKeyword } from "./pivotClustering";

function keyword(keyword: string, volume: number, urls: string[]): PivotKeyword {
	return { keyword, volume, urls: new Set(urls) };
}

describe("getPivotClusters", () => {
	test("does not merge clusters through a transitive similarity chain", () => {
		const clusters = getPivotClusters(
			[
				keyword("a", 100, ["1", "2", "3", "4"]),
				keyword("b", 90, ["1", "2", "5", "6"]),
				keyword("c", 80, ["5", "6", "7", "8"]),
			],
			0.5,
		);

		expect(clusters).toEqual([["a", "b"], ["c"]]);
	});

	test("reattaches a keyword to its most similar eligible pivot", () => {
		const clusters = getPivotClusters(
			[
				keyword("pivot-a", 100, ["a", "b", "c", "d"]),
				keyword("candidate", 90, ["a", "b", "e", "f"]),
				keyword("pivot-b", 80, ["b", "e", "f", "g"]),
			],
			0.5,
		);

		expect(clusters).toEqual([["pivot-a"], ["pivot-b", "candidate"]]);
	});

	test("keeps keywords without organic URLs as singletons", () => {
		expect(getPivotClusters([keyword("empty", 10, [])], 0.5)).toEqual([["empty"]]);
	});
});
