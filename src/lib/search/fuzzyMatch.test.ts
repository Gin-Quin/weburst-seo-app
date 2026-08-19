import { expect, test } from "bun:test";
import { fuzzyMatch } from "./fuzzyMatch";

test("matches direct text regardless of case and accents", () => {
	expect(fuzzyMatch("similarite", ["Similarité SEO"])).toBe(true);
});

test("matches a compact fuzzy subsequence", () => {
	expect(fuzzyMatch("nvlw", ["novlaw.fr"])).toBe(true);
});

test("checks every candidate field", () => {
	expect(fuzzyMatch("agence", ["example.com", "Agence DPC"])).toBe(true);
});

test("rejects unrelated or excessively scattered text", () => {
	expect(fuzzyMatch("alpha", ["novlaw.fr", "Agence DPC"])).toBe(false);
});
