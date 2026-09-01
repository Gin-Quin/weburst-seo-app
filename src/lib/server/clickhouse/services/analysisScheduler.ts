import { DAY, HOUR } from "$lib/timeUnits";
import type { KeywordAnalysisFrequency, ProjectType } from "../../../../routes/api/projects.schema";
import type { ClickhouseTable } from "../migrations";

export const FAILED_ANALYSIS_RETRY_DELAY = 6 * HOUR;
export const RECURRING_ANALYSIS_PROJECT_TYPES: ProjectType[] = ["monthly_subscription"];

export const ANALYSIS_INTERVALS: Record<KeywordAnalysisFrequency, number> = {
	"1/day": DAY,
	"1/week": 7 * DAY,
	"2/month": 15 * DAY,
	"1/month": 30 * DAY,
};

export type SchedulableProject = {
	id: string;
	keywordAnalysisFrequency: KeywordAnalysisFrequency;
};

export type LatestAnalysisState = {
	status: ClickhouseTable.KeywordAnalysis["status"];
	createdAtMs: number;
};

export function isProjectAnalysisDue({
	project,
	latestAnalysis,
	nowMs,
}: {
	project: SchedulableProject;
	latestAnalysis?: LatestAnalysisState;
	nowMs: number;
}): boolean {
	if (!latestAnalysis) return true;
	if (latestAnalysis.status === "pending") return false;

	const delay =
		latestAnalysis.status === "failed"
			? FAILED_ANALYSIS_RETRY_DELAY
			: ANALYSIS_INTERVALS[project.keywordAnalysisFrequency];

	return latestAnalysis.createdAtMs + delay <= nowMs;
}

export function selectProjectsDueForAnalysis({
	projects,
	latestAnalysisByProjectId,
	nowMs,
}: {
	projects: SchedulableProject[];
	latestAnalysisByProjectId: ReadonlyMap<string, LatestAnalysisState>;
	nowMs: number;
}): SchedulableProject[] {
	return projects.filter((project) =>
		isProjectAnalysisDue({
			project,
			latestAnalysis: latestAnalysisByProjectId.get(project.id),
			nowMs,
		}),
	);
}

export type DueAnalysisRunResult = {
	projectId: string;
	status: "started" | "failed";
	error?: unknown;
};

export async function runDueProjectAnalyses({
	projects,
	startAnalysis,
	waitBetweenProjects,
	signal,
}: {
	projects: SchedulableProject[];
	startAnalysis: (projectId: string) => Promise<unknown>;
	waitBetweenProjects: () => Promise<void>;
	signal?: AbortSignal;
}): Promise<DueAnalysisRunResult[]> {
	const results: DueAnalysisRunResult[] = [];

	for (const [index, project] of projects.entries()) {
		if (signal?.aborted) break;

		try {
			await startAnalysis(project.id);
			results.push({ projectId: project.id, status: "started" });
		} catch (error) {
			results.push({ projectId: project.id, status: "failed", error });
		}

		if (!signal?.aborted && index < projects.length - 1) {
			await waitBetweenProjects();
		}
	}

	return results;
}
