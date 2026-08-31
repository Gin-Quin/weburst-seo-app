import * as v from "valibot";

const KeywordWithCluster = v.tuple([v.string(), v.number(), v.string()]);
const KeywordWithoutCluster = v.tuple([v.string(), v.number()]);

export const KeywordImportMode = v.picklist(["replace", "append"]);

export const AddKeywords = v.object({
	projectId: v.string(),
	mode: KeywordImportMode,
	keywords: v.array(
		// Valibot tuples discard trailing items. Match the longer tuple first so the
		// cluster is not silently removed from three-column keyword rows.
		v.union([KeywordWithCluster, KeywordWithoutCluster]),
	),
});
