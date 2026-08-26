import { describe, expect, test } from "bun:test";
import { getClusterBarChartData } from "./getClusterBarChartData";

const clusters = [
	{
		name: "SEO",
		keywordCount: 2,
		totalVolume: 1_000,
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
		expect(result.data[0]).toMatchObject({
			clientShare: 40,
			comparisonShare: 25,
		});
	});

	test("compares the client with the sum of all competitors otherwise", () => {
		const result = getClusterBarChartData({
			clusters,
			clientDomain: "client.test",
			selectedDomains: ["client.test", "first.test", "second.test"],
		});

		expect(result.comparisonDomain).toBeUndefined();
		expect(result.data[0]).toMatchObject({
			clientShare: 40,
			comparisonShare: 35,
		});
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
