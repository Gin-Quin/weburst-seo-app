import { describe, expect, test } from "bun:test";
import { DAY, HOUR } from "$lib/timeUnits";
import {
	ANALYSIS_INTERVALS,
	FAILED_ANALYSIS_RETRY_DELAY,
	isProjectAnalysisDue,
	runDueProjectAnalyses,
	selectProjectsDueForAnalysis,
	type SchedulableProject,
} from "./analysisScheduler";

const project = (
	id: string,
	keywordAnalysisFrequency: SchedulableProject["keywordAnalysisFrequency"],
): SchedulableProject => ({ id, keywordAnalysisFrequency });

describe("analysis scheduling", () => {
	test("uses elapsed intervals for every configured frequency", () => {
		const nowMs = 10_000_000_000;

		for (const [frequency, interval] of Object.entries(ANALYSIS_INTERVALS)) {
			const item = project(frequency, frequency as keyof typeof ANALYSIS_INTERVALS);

			expect(
				isProjectAnalysisDue({
					project: item,
					latestAnalysis: { status: "completed", createdAtMs: nowMs - interval + 1 },
					nowMs,
				}),
			).toBe(false);
			expect(
				isProjectAnalysisDue({
					project: item,
					latestAnalysis: { status: "completed", createdAtMs: nowMs - interval },
					nowMs,
				}),
			).toBe(true);
		}
	});

	test("runs projects with no previous analysis immediately", () => {
		expect(
			isProjectAnalysisDue({
				project: project("new", "1/month"),
				nowMs: Date.now(),
			}),
		).toBe(true);
	});

	test("never duplicates a pending analysis", () => {
		expect(
			isProjectAnalysisDue({
				project: project("pending", "1/day"),
				latestAnalysis: { status: "pending", createdAtMs: 0 },
				nowMs: 100 * DAY,
			}),
		).toBe(false);
	});

	test("retries failed analyses after the failure cooldown", () => {
		const nowMs = 20 * DAY;
		const item = project("failed", "1/month");

		expect(
			isProjectAnalysisDue({
				project: item,
				latestAnalysis: {
					status: "failed",
					createdAtMs: nowMs - FAILED_ANALYSIS_RETRY_DELAY + HOUR,
				},
				nowMs,
			}),
		).toBe(false);
		expect(
			isProjectAnalysisDue({
				project: item,
				latestAnalysis: {
					status: "failed",
					createdAtMs: nowMs - FAILED_ANALYSIS_RETRY_DELAY,
				},
				nowMs,
			}),
		).toBe(true);
	});

	test("selects only due projects", () => {
		const nowMs = 100 * DAY;
		const projects = [project("due", "1/day"), project("fresh", "1/day")];
		const latest = new Map([
			["due", { status: "completed" as const, createdAtMs: nowMs - DAY }],
			["fresh", { status: "completed" as const, createdAtMs: nowMs - HOUR }],
		]);

		expect(
			selectProjectsDueForAnalysis({
				projects,
				latestAnalysisByProjectId: latest,
				nowMs,
			}).map(({ id }) => id),
		).toEqual(["due"]);
	});

	test("continues after one project fails and waits only between projects", async () => {
		const events: string[] = [];
		const projects = [project("one", "1/day"), project("two", "1/day")];

		const results = await runDueProjectAnalyses({
			projects,
			startAnalysis: async (projectId) => {
				events.push(`start:${projectId}`);
				if (projectId === "one") throw new Error("broken");
			},
			waitBetweenProjects: async () => {
				events.push("wait");
			},
		});

		expect(events).toEqual(["start:one", "wait", "start:two"]);
		expect(results.map(({ projectId, status }) => ({ projectId, status }))).toEqual([
			{ projectId: "one", status: "failed" },
			{ projectId: "two", status: "started" },
		]);
	});
});
