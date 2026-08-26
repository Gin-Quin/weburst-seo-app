import { describe, expect, test } from "bun:test";
import { safeParse } from "valibot";
import { ArticleLimit, ProjectName, ProjectType } from "./projects.schema";

describe("project schema", () => {
	test("accepts monthly subscriptions", () => {
		expect(safeParse(ProjectType, "monthly_subscription").success).toBe(true);
	});

	test("accepts only non-negative integer article limits", () => {
		expect(safeParse(ArticleLimit, 10).success).toBe(true);
		expect(safeParse(ArticleLimit, 0).success).toBe(true);
		expect(safeParse(ArticleLimit, -1).success).toBe(false);
		expect(safeParse(ArticleLimit, 1.5).success).toBe(false);
	});

	test("requires a non-empty project name", () => {
		expect(safeParse(ProjectName, "SEO launch").success).toBe(true);
		expect(safeParse(ProjectName, "   ").success).toBe(false);
	});
});
