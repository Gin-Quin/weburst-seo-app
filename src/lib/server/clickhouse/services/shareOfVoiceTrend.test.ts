import { describe, expect, test } from "bun:test";
import { applyShareOfVoiceTrends, selectTrendReferenceAnalysis } from "./shareOfVoiceTrend";

describe("selectTrendReferenceAnalysis", () => {
	test("selects the most recent analysis that is at least 30 days old", () => {
		const analyses = [
			{ id: "recent", createdAt: "2026-08-15T12:00:00.000Z" },
			{ id: "eligible", createdAt: "2026-08-01T12:00:00.000Z" },
			{ id: "older", createdAt: "2026-07-01T12:00:00.000Z" },
		];

		expect(selectTrendReferenceAnalysis(analyses, "2026-08-31T12:00:00.000Z")?.id).toBe("eligible");
	});

	test("does not fall back to a more recent analysis", () => {
		const analyses = [
			{ id: "current", createdAt: "2026-08-31T12:00:00.000Z" },
			{ id: "recent", createdAt: "2026-08-02T12:00:00.000Z" },
		];

		expect(selectTrendReferenceAnalysis(analyses, "2026-08-31T12:00:00.000Z")).toBeUndefined();
	});

	test("works regardless of input order", () => {
		const analyses = [
			{ id: "oldest", createdAt: "2026-06-01T12:00:00.000Z" },
			{ id: "latest-eligible", createdAt: "2026-07-20T12:00:00.000Z" },
		];

		expect(selectTrendReferenceAnalysis(analyses, "2026-08-31T12:00:00.000Z")?.id).toBe(
			"latest-eligible",
		);
	});
});

describe("applyShareOfVoiceTrends", () => {
	test("computes the share-of-voice change in percentage ratio", () => {
		const [row] = applyShareOfVoiceTrends(
			[{ domain: "example.com", volume: 30, trend: 999 }],
			100,
			[{ domain: "https://example.com", volume: 20 }],
			100,
		);

		expect(row?.trend).toBeCloseTo(0.1);
	});

	test("clears stale trends when no eligible reference exists", () => {
		const [row] = applyShareOfVoiceTrends(
			[{ domain: "example.com", volume: 30, trend: 0.2 }],
			100,
			undefined,
			0,
		);

		expect(row?.trend).toBeUndefined();
	});
});
