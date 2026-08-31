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
	test("compares the client with the only selected competitor", () => {
		const result = getClusterBarChartData({
			clusters,
			clientDomain: "client.test",
			selectedDomains: ["client.test", "first.test"],
		});

		expect(result.comparisonDomain).toBe("first.test");
		expect(result.data[0]?.clientShare).toBeCloseTo(400 / 7.5);
		expect(result.data[0]?.comparisonShare).toBeCloseTo(250 / 7.5);
	});

	test("compares the client with the sum of the selected competitors", () => {
		const result = getClusterBarChartData({
			clusters,
			clientDomain: "client.test",
			selectedDomains: ["client.test", "first.test", "second.test"],
		});

		expect(result.comparisonDomain).toBeUndefined();
		expect(result.data[0]?.clientShare).toBeCloseTo(400 / 7.5);
		expect(result.data[0]?.comparisonShare).toBeCloseTo(350 / 7.5);
	});

	test("excludes competitors that are not selected", () => {
		const result = getClusterBarChartData({
			clusters: [
				{
					...clusters[0]!,
					domains: [
						...clusters[0]!.domains,
						{ domain: "unselected.test", volume: 200 },
					],
				},
			],
			clientDomain: "client.test",
			selectedDomains: ["client.test", "first.test", "second.test"],
		});

		expect(result.data[0]?.comparisonVolume).toBe(350);
	});

	test("uses all competitors when none is selected", () => {
		const result = getClusterBarChartData({
			clusters,
			clientDomain: "client.test",
			selectedDomains: ["client.test"],
		});

		expect(result.data[0]?.comparisonVolume).toBe(350);
	});
});
