import { describe, expect, test } from "bun:test";
import { getClusterBarChartData } from "./getClusterBarChartData";

const clusters = [
	{
		name: "SEO",
		keywordCount: 2,
		totalVolume: 1_000,
		totalTraffic: 750,
		domains: [
			{ domain: "client.test", volume: 400 },
			{ domain: "first.test", volume: 250 },
			{ domain: "second.test", volume: 100 },
		],
	},
];

describe("getClusterBarChartData", () => {
	test("compares the client with the strongest competitor", () => {
		const result = getClusterBarChartData({
			clusters,
			clientDomain: "client.test",
		});

		expect(result.data[0]?.comparisonDomain).toBe("first.test");
		expect(result.data[0]?.clientShare).toBeCloseTo(400 / 7.5);
		expect(result.data[0]?.comparisonShare).toBeCloseTo(250 / 7.5);
	});

	test("compares the client with the strongest competitor in each cluster", () => {
		const result = getClusterBarChartData({
			clusters,
			clientDomain: "client.test",
		});

		expect(result.data[0]?.comparisonDomain).toBe("first.test");
		expect(result.data[0]?.clientShare).toBeCloseTo(400 / 7.5);
		expect(result.data[0]?.comparisonShare).toBeCloseTo(250 / 7.5);
	});

	test("includes cluster leaders outside the dashboard selection", () => {
		const result = getClusterBarChartData({
			clusters: [
				{
					...clusters[0]!,
					domains: [
						...clusters[0]!.domains,
						{ domain: "unselected.test", volume: 600 },
					],
				},
			],
			clientDomain: "client.test",
		});

		expect(result.data[0]?.comparisonVolume).toBe(600);
	});

	test("uses all competitors when none is selected", () => {
		const result = getClusterBarChartData({
			clusters,
			clientDomain: "client.test",
		});

		expect(result.data[0]?.comparisonVolume).toBe(250);
	});
});

 test("selects a different leader for each cluster and handles empty clusters", () => {
 const result = getClusterBarChartData({ clientDomain: "client.test", clusters: [
 ...clusters,
 { ...clusters[0]!, name: "Content", domains: [{ domain: "second.test", volume: 500 }] },
 { ...clusters[0]!, name: "Empty", totalTraffic: 0, domains: [] },
 ] });
 expect(result.data.map((row) => row.comparisonDomain)).toEqual(["first.test", "second.test", undefined]);
 expect(result.data[2]?.comparisonShare).toBe(0);
 });
