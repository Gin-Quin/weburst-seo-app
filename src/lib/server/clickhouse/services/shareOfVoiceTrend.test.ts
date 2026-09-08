import { describe, expect, test } from "bun:test";
import { applyShareOfVoiceTrends, getTrendDays, selectTrendReferenceAnalysis } from "./shareOfVoiceTrend";

describe("selectTrendReferenceAnalysis", () => {
	test("selects the most recent analysis that is at least 30 days old", () => {
		const analyses = [
			{ id: "recent", createdAt: "2026-08-15T12:00:00.000Z" },
			{ id: "eligible", createdAt: "2026-08-01T12:00:00.000Z" },
			{ id: "older", createdAt: "2026-07-01T12:00:00.000Z" },
		];

		expect(selectTrendReferenceAnalysis(analyses, "2026-08-31T12:00:00.000Z", "1/month")?.id).toBe("eligible");
	});

	test("does not fall back to a more recent analysis", () => {
		const analyses = [
			{ id: "current", createdAt: "2026-08-31T12:00:00.000Z" },
			{ id: "recent", createdAt: "2026-08-02T12:00:00.000Z" },
		];

		expect(selectTrendReferenceAnalysis(analyses, "2026-08-31T12:00:00.000Z", "1/month")).toBeUndefined();
	});

	test("works regardless of input order", () => {
		const analyses = [
			{ id: "oldest", createdAt: "2026-06-01T12:00:00.000Z" },
			{ id: "latest-eligible", createdAt: "2026-07-20T12:00:00.000Z" },
		];

		expect(selectTrendReferenceAnalysis(analyses, "2026-08-31T12:00:00.000Z", "1/month")?.id).toBe(
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

describe("trend period", () => {
	test("uses the selected reference even when it is more than 60 days old", () => {
		const current = "2026-08-31T12:00:00.000Z";
		const reference = selectTrendReferenceAnalysis([
			{ id: "recent", createdAt: "2026-08-20T12:00:00.000Z" },
			{ id: "older", createdAt: "2026-06-01T12:00:00.000Z" },
		], current);
		expect(getTrendDays(current, reference?.createdAt)).toBe(91);
	});

	test("counts complete elapsed days from the analysis date", () => {
		expect(getTrendDays("2026-08-31T18:00:00.000Z", "2026-08-01T12:00:00.000Z")).toBe(30);
	});

	test("does not report a period without a reference or with reversed dates", () => {
		expect(getTrendDays("2026-08-31T12:00:00.000Z")).toBeUndefined();
		expect(getTrendDays("2026-08-31T12:00:00.000Z", "2026-09-01T12:00:00.000Z")).toBeUndefined();
	});
});


describe("analysis frequency reference", () => {
	for (const [frequency, days] of [["1/week", 7], ["2/month", 15], ["1/month", 30], [null, 14], [undefined, 14]] as const) {
		test(`uses ${days} days for ${frequency ?? "no frequency"}`, () => {
			const now = Date.parse("2026-08-31T12:00:00.000Z");
			const cutoff = now - days * 86_400_000;
			const reference = selectTrendReferenceAnalysis([
				{ id: "older", createdAt: new Date(cutoff - 86_400_000).toISOString() },
				{ id: "too-recent", createdAt: new Date(cutoff + 1).toISOString() },
				{ id: "eligible", createdAt: new Date(cutoff).toISOString() },
			], new Date(now).toISOString(), frequency);
			expect(reference?.id).toBe("eligible");
			expect(getTrendDays(new Date(now).toISOString(), reference?.createdAt)).toBe(days);
			expect(selectTrendReferenceAnalysis([
				{ id: "too-recent", createdAt: new Date(cutoff + 1).toISOString() },
			], new Date(now).toISOString(), frequency)).toBeUndefined();
		});
	}
});
