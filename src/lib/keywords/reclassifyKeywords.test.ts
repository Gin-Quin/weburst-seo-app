import { describe, expect, test } from "bun:test";
import { getReclassifiedClusterSummaries, reclassifyKeywords } from "./reclassifyKeywords";

describe("historical keyword reclassification", () => {
	const historical = [
		{ name: "seo", volume: 100, clusters: "" },
		{ name: "content", volume: 200, clusters: "Old" },
		{ name: "removed", volume: 300, clusters: "Old" },
		{ name: "cleared", volume: 400, clusters: "Old" },
	];
	const current = new Map([
		["seo", { name: "seo", volume: 9999, clusters: " SEO " }],
		["content", { name: "content", volume: 8888, clusters: "SEO" }],
		["cleared", { name: "cleared", volume: 7777, clusters: "  " }],
		["new", { name: "new", volume: 6666, clusters: "New cluster" }],
	]);

	test("relabels existing keywords without changing historical volumes or adding new keywords", () => {
		const before = structuredClone(historical);
		const currentBefore = structuredClone(current);
		expect([...reclassifyKeywords(historical, current).values()]).toEqual([
			{ name: "seo", volume: 100, clusters: "SEO" },
			{ name: "content", volume: 200, clusters: "SEO" },
			{ name: "removed", volume: 300, clusters: "" },
			{ name: "cleared", volume: 400, clusters: "" },
		]);
		expect(historical).toEqual(before);
		expect(current).toEqual(currentBefore);
	});

	test("totals historical volumes and keeps currently configured clusters selectable with zero data", () => {
		const reclassified = reclassifyKeywords(historical, current);
		expect(getReclassifiedClusterSummaries(reclassified.values(), current.values())).toEqual([
			{ name: "SEO", keywordCount: 2, totalVolume: 300 },
			{ name: "New cluster", keywordCount: 0, totalVolume: 0 },
		]);
	});

	test("removes stale labels when the current list has no clusters", () => {
		const noClusters = new Map(
			historical.map((keyword) => [keyword.name, { ...keyword, clusters: "" }]),
		);
		const reclassified = reclassifyKeywords(historical, noClusters);
		expect([...reclassified.values()].every((keyword) => keyword.clusters === "")).toBe(true);
		expect(getReclassifiedClusterSummaries(reclassified.values(), noClusters.values())).toEqual([]);
	});

	test("keeps a cluster available when its keywords are absent from the latest analysis", () => {
		const reclassified = reclassifyKeywords([], current);
		expect(getReclassifiedClusterSummaries(reclassified.values(), current.values())).toEqual([
			{ name: "New cluster", keywordCount: 0, totalVolume: 0 },
			{ name: "SEO", keywordCount: 0, totalVolume: 0 },
		]);
	});
});
