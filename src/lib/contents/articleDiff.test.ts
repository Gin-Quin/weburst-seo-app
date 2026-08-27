import { expect, test } from "bun:test";
import { diffSequence } from "./articleDiff";

test("diffSequence marks inserted and removed article blocks", () => {
	expect(
		diffSequence(["title", "old paragraph", "image"], ["title", "new paragraph", "image"]),
	).toEqual({
		before: ["unchanged", "removed", "unchanged"],
		after: ["unchanged", "added", "unchanged"],
	});
});

test("diffSequence keeps duplicate blocks aligned", () => {
	expect(diffSequence(["paragraph", "paragraph"], ["paragraph", "addition", "paragraph"])).toEqual({
		before: ["unchanged", "unchanged"],
		after: ["unchanged", "added", "unchanged"],
	});
});
