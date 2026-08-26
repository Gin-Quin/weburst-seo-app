import { describe, expect, test } from "bun:test";
import { parse, type InferInput } from "valibot";
import { AddKeywords } from "./keywords.schema";

describe("keyword schema", () => {
	test("preserves optional cluster labels", () => {
		const input: InferInput<typeof AddKeywords> = {
			projectId: "project-a",
			keywords: [
				["technical seo", 1200, "SEO"],
				["content brief", 350],
			],
		};

		expect(parse(AddKeywords, input)).toEqual(input);
	});
});
