import { expect, test } from "bun:test";
import { getKeywordTaskFailure } from "./analysisFailure";

test("rejects partial results even when the response contains result data", () => {
	expect(
		getKeywordTaskFailure({ status_code: 40106, status_message: "Partial results", result: [] }),
	).toBe("40106: Partial results");
});

test("distinguishes a valid empty result from missing provider data", () => {
	expect(
		getKeywordTaskFailure({ status_code: 20000, status_message: "Ok", result: [] }),
	).toBeUndefined();
	expect(getKeywordTaskFailure({ status_code: 20000, status_message: "Ok", result: null })).toBe(
		"Task completed without result data",
	);
});
