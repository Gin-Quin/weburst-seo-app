import { describe, expect, test } from "bun:test";
import { parse, type InferInput } from "valibot";
import { AddKeywords } from "./keywords.schema";

describe("keyword schema", () => {
	test("preserves optional cluster labels", () => {
		const input: InferInput<typeof AddKeywords> = {
			projectId: "project-a",
			mode: "replace",
			keywords: [
				["technical seo", 1200, "SEO"],
				["content brief", 350],
			],
		};

		expect(parse(AddKeywords, input)).toEqual(input);
	});

	test("accepts both keyword import modes", () => {
		for (const mode of ["replace", "append"] as const) {
			expect(
				parse(AddKeywords, {
					projectId: "project-a",
					mode,
					keywords: [["technical seo", 1200]],
				}),
			).toMatchObject({ mode });
		}
	});

	test("rejects empty keyword imports", () => {
		expect(() =>
			parse(AddKeywords, {
				projectId: "project-a",
				mode: "replace",
				keywords: [],
			}),
		).toThrow();
	});
});
