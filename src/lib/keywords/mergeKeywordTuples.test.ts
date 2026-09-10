import { describe, expect, test } from "bun:test";
import { mergeKeywordTuples } from "./mergeKeywordTuples";
import { parseKeywordsCsv } from "./parseKeywordsCsv";
import { parse } from "valibot";
import { AddKeywords } from "../../routes/api/keywords.schema";

describe("mergeKeywordTuples", () => {
	test("adds imported clusters to old keywords through CSV and API validation without changing the old set", async () => {
		const existingKeywords = [
			{ name: "audit seo", volume: 100, clusters: "" },
			{ name: "content brief", volume: 50, clusters: "Original" },
			{ name: "untouched", volume: 20, clusters: "Other" },
		];
		const oldSet = structuredClone(existingKeywords);
		const imported = parse(AddKeywords, {
			projectId: "project-a",
			mode: "append",
			keywords: await parseKeywordsCsv(
				"Mot-clé,Volume,Cluster\naudit seo,150,SEO\ncontent brief,75,Content\nnew keyword,30,SEO",
			),
		});

		expect(mergeKeywordTuples(existingKeywords, imported.keywords)).toEqual([
			["audit seo", 150, "SEO"],
			["content brief", 75, "Content"],
			["untouched", 20, "Other"],
			["new keyword", 30, "SEO"],
		]);
		expect(existingKeywords).toEqual(oldSet);
	});

	test("keeps existing keywords and adds imported keywords", () => {
		expect(
			mergeKeywordTuples(
				[{ name: "existing", volume: 100, clusters: "Original" }],
				[["new", 200, "Imported"]],
			),
		).toEqual([
			["existing", 100, "Original"],
			["new", 200, "Imported"],
		]);
	});

	test("uses the imported values when a keyword already exists", () => {
		expect(
			mergeKeywordTuples(
				[{ name: "shared", volume: 100, clusters: "Original" }],
				[
					["shared", 250, "Updated"],
					["shared", 300, "Duplicate"],
				],
			),
		).toEqual([["shared", 250, "Updated"]]);
	});
});
