import { expect, test } from "bun:test";
import { diffSequence, diffText } from "./articleDiff";

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

test("diffText highlights changed words inside a paragraph", () => {
	const diff = diffText(
		"This is a detailed writing report.",
		"This is a comprehensive writing report.",
	);

	expect(diff).toEqual({
		before: [
			{ value: "This is a ", state: "unchanged" },
			{ value: "detailed", state: "removed" },
			{ value: " writing report.", state: "unchanged" },
		],
		after: [
			{ value: "This is a ", state: "unchanged" },
			{ value: "comprehensive", state: "added" },
			{ value: " writing report.", state: "unchanged" },
		],
	});
});

test("diffText preserves punctuation, whitespace, and apostrophes", () => {
	const before = "L’ancien texte, ici.\nDeuxième ligne.";
	const after = "Le nouveau texte, ici !\nDeuxième ligne.";
	const diff = diffText(before, after);

	expect(diff.before.map(({ value }) => value).join("")).toBe(before);
	expect(diff.after.map(({ value }) => value).join("")).toBe(after);
	expect(diff.before.some(({ state }) => state === "removed")).toBe(true);
	expect(diff.after.some(({ state }) => state === "added")).toBe(true);
});
