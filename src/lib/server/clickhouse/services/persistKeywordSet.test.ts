import { expect, test } from "bun:test";
import { persistKeywordSet } from "./persistKeywordSet";

const input = { projectId: "project", setId: "replacement", keywords: [{ name: "seo", volume: 10, clusters: "SEO" }] };

test("replacement set is published only after its keyword rows are saved", async () => {
	const batches: unknown[] = [];
	await persistKeywordSet(input, async (batch) => { batches.push(batch); });
	expect(batches).toEqual([
		{ table: "keywords", values: [{ setId: "replacement", ...input.keywords[0] }], format: "JSON" },
		{ table: "keywordSets", values: [{ id: "replacement", projectId: "project" }], format: "JSON" },
	]);
});

test("failed replacement leaves the previous set current", async () => {
	const tables: string[] = [];
	await expect(persistKeywordSet(input, async ({ table }) => {
		tables.push(table);
		throw new Error("insert failed");
	})).rejects.toThrow("insert failed");
	expect(tables).toEqual(["keywords"]);
});
