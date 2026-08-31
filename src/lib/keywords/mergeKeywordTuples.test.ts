import { describe, expect, test } from "bun:test";
import { mergeKeywordTuples } from "./mergeKeywordTuples";

describe("mergeKeywordTuples", () => {
	test("keeps existing keywords and adds imported keywords", () => {
		expect(
			mergeKeywordTuples(
				[{ name: "existing", volume: 100, clusters: "Original" }],
				[["new", 200, "Imported"]],
			),
		).toEqual([
			["existing", 100, "Original"],
			["new", 200, "Imported"],
		]);
	});

	test("uses the imported values when a keyword already exists", () => {
		expect(
			mergeKeywordTuples(
				[{ name: "shared", volume: 100, clusters: "Original" }],
				[
					["shared", 250, "Updated"],
					["shared", 300, "Duplicate"],
				],
			),
		).toEqual([["shared", 250, "Updated"]]);
	});
});
