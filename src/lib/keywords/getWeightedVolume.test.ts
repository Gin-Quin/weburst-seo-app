import { describe, expect, test } from "bun:test";
import { getWeightedVolume } from "./getWeightedVolume";

describe("getWeightedVolume", () => {
	test("uses the new CTR curve for positions 1 through 10", () => {
		expect(getWeightedVolume(1_000, 1)).toBe(200);
		expect(getWeightedVolume(1_000, 3)).toBe(80);
		expect(getWeightedVolume(1_000, 10)).toBe(10);
	});

	test("does not attribute traffic beyond the top 10", () => {
		expect(getWeightedVolume(1_000, 11)).toBe(0);
	});
});
