import { describe, expect, test } from "bun:test";
import { selectLatestAnalysisPerDay } from "./selectLatestAnalysisPerDay";

describe("selectLatestAnalysisPerDay", () => {
	test("keeps only the latest analysis from each calendar day", () => {
		const analyses = [
			{ id: "day-11-middle", createdAt: "2026-08-11 12:00:00" },
			{ id: "day-12-last", createdAt: "2026-08-12 18:00:00" },
			{ id: "day-11-first", createdAt: "2026-08-11 08:00:00" },
			{ id: "day-14", createdAt: "2026-08-14 10:00:00" },
			{ id: "day-12-first", createdAt: "2026-08-12 09:00:00" },
			{ id: "day-11-last", createdAt: "2026-08-11 20:00:00" },
		];

		expect(selectLatestAnalysisPerDay(analyses).map(({ id }) => id)).toEqual([
			"day-14",
			"day-12-last",
			"day-11-last",
		]);
	});

	test("keeps analyses from different days even when a day is missing", () => {
		const analyses = [
			{ id: "day-14", createdAt: "2026-08-14 10:00:00" },
			{ id: "day-11", createdAt: "2026-08-11 20:00:00" },
		];

		expect(selectLatestAnalysisPerDay(analyses)).toEqual(analyses);
	});
});
