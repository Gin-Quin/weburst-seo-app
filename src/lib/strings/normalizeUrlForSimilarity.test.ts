import { describe, expect, test } from "bun:test";
import { normalizeUrlForSimilarity } from "./normalizeUrlForSimilarity";

describe("normalizeUrlForSimilarity", () => {
	test("applies the tracking, scheme, www, fragment and trailing-slash rules", () => {
		expect(
			normalizeUrlForSimilarity(
				"https://WWW.Example.com/path/?utm_source=google&id=42&fbclid=x#section",
			),
		).toBe("example.com/path?id=42");
	});

	test("keeps the root slash and non-tracking query parameters", () => {
		expect(normalizeUrlForSimilarity("http://example.com/?page=2")).toBe("example.com/?page=2");
	});

	test("returns an empty value for invalid or empty URLs", () => {
		expect(normalizeUrlForSimilarity("")).toBe("");
		expect(normalizeUrlForSimilarity("not a url")).toBe("");
	});
});
