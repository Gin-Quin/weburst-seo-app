import { describe, expect, test } from "bun:test";
import { getSimilarity } from "./getSimilarity";

describe("getSimilarity", () => {
	test("uses the Sørensen–Dice coefficient", () => {
		expect(getSimilarity(new Set(["a", "b", "c"]), new Set(["a", "b"]))).toBe(0.8);
	});

	test("does not consider two empty SERPs similar", () => {
		expect(getSimilarity(new Set(), new Set())).toBe(0);
	});
});
