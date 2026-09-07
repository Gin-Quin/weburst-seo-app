import type { Keyword } from "./keywords";

export async function persistKeywordSet(
	input: { projectId: string; setId: string; keywords: Keyword[] },
	insert: (batch: { table: string; values: Record<string, unknown>[]; format: "JSON" }) => Promise<unknown>,
) {
	await insert({
		table: "keywords",
		values: input.keywords.map((keyword) => ({ setId: input.setId, ...keyword })),
		format: "JSON",
	});
	// Only complete imports become visible to readers and analysis workers.
	await insert({
		table: "keywordSets",
		values: [{ id: input.setId, projectId: input.projectId }],
		format: "JSON",
	});
}
