import type { Keyword, KeywordTuple } from "$lib/server/clickhouse/services/keywords";

/**
 * Merge imported keywords into an existing keyword set.
 *
 * The first occurrence in the imported file wins, matching the existing import
 * behaviour. Imported values replace an existing keyword with the same name.
 */
export function mergeKeywordTuples(
	existingKeywords: Iterable<Keyword>,
	importedKeywords: Array<KeywordTuple>,
): Array<KeywordTuple> {
	const merged = new Map<string, KeywordTuple>();

	for (const { name, volume, clusters } of existingKeywords) {
		merged.set(name, [name, volume, clusters]);
	}

	const importedNames = new Set<string>();
	for (const keyword of importedKeywords) {
		const [name] = keyword;
		if (importedNames.has(name)) continue;

		importedNames.add(name);
		merged.set(name, keyword);
	}

	return [...merged.values()];
}
