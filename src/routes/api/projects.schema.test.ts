import { describe, expect, test } from "bun:test";
import { safeParse } from "valibot";
import {
	ArticleLimit,
	CreateProject,
	hasAtLeastOneProjectTool,
	ProjectName,
	ProjectType,
} from "./projects.schema";

describe("project schema", () => {
	test("accepts monthly subscriptions", () => {
		expect(safeParse(ProjectType, "monthly_subscription").success).toBe(true);
	});

	test("accepts audits and rejects the retired prospect type", () => {
		expect(safeParse(ProjectType, "audit").success).toBe(true);
		expect(safeParse(ProjectType, "prospect").success).toBe(false);
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

	test("requires at least one available project tool", () => {
		const project = {
			id: "project-1",
			name: "SEO launch",
			clientId: "client-1",
			domain: "example.com",
			websiteUrl: "https://example.com",
			type: "audit" as const,
			keywordAnalysisFrequency: "1/month" as const,
			articleLimit: 10,
			shareOfVoiceEnabled: false,
			contentWritingEnabled: false,
		};

		expect(safeParse(CreateProject, project).success).toBe(false);
		expect(safeParse(CreateProject, { ...project, shareOfVoiceEnabled: true }).success).toBe(true);
		expect(safeParse(CreateProject, { ...project, contentWritingEnabled: true }).success).toBe(
			true,
		);
	});

	test("keeps both tools enabled when older callers omit them", () => {
		expect(hasAtLeastOneProjectTool({})).toBe(true);
	});
});
