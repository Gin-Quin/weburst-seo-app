import { expect, test } from "bun:test";
import { getAnalysisFailureReason } from "./analysisFailure";

test("recognizes partial results in current and historical analysis errors", () => {
	expect(getAnalysisFailureReason("40106: Task completed with partial results")).toBe(
		"partial_results",
	);
	expect(
		getAnalysisFailureReason(
			"1/84 keyword analysis tasks failed\n40106: Task completed with partial results",
		),
	).toBe("partial_results");
});

test("returns a generic frontend reason for other failures", () => {
	for (const error of [
		"",
		"Task completed without result data",
		"40200: Payment Required",
		"Internal database failure",
	]) {
		expect(getAnalysisFailureReason(error)).toBe("analysis_failed");
	}
});
