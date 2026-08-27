import { describe, expect, test } from "bun:test";
import { getDomainMetrics, hostMatchesTarget } from "./serpAnalytics";

describe("getDomainMetrics", () => {
	test("uses the best organic position once per keyword and domain", () => {
		const result = getDomainMetrics(
			[
				{ keyword: "seo", domain: "www.example.com", position: 3, type: "organic" },
				{ keyword: "seo", domain: "https://example.com/path", position: 1, type: "organic" },
				{ keyword: "seo", domain: "example.com", position: 1, type: "paid" },
				{ keyword: "audit", domain: "example.com", position: 10, type: "organic_extended" },
			],
			new Map([
				["seo", 1_000],
				["audit", 500],
			]),
		);

		expect(result).toEqual([
			{
				domain: "example.com",
				estimatedTraffic: 205,
				topThreeKeywordCount: 1,
				topTenKeywordCount: 2,
				positionedKeywordCount: 2,
			},
		]);
	});

	test("omits domains that only rank beyond the top 10", () => {
		expect(
			getDomainMetrics(
				[{ keyword: "seo", domain: "example.com", position: 11, type: "organic" }],
				new Map([["seo", 1_000]]),
			),
		).toEqual([]);
	});
});

describe("hostMatchesTarget", () => {
	test("matches the target host and its subdomains, but not suffix lookalikes", () => {
		expect(hostMatchesTarget("www.example.com", "example.com")).toBeTrue();
		expect(hostMatchesTarget("shop.example.com", "https://example.com/")).toBeTrue();
		expect(hostMatchesTarget("notexample.com", "example.com")).toBeFalse();
	});
});
