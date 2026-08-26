import * as v from "valibot";

const KeywordWithCluster = v.tuple([v.string(), v.number(), v.string()]);
const KeywordWithoutCluster = v.tuple([v.string(), v.number()]);

export const AddKeywords = v.object({
	projectId: v.string(),
	keywords: v.array(
		// Valibot tuples discard trailing items. Match the longer tuple first so the
		// cluster is not silently removed from three-column keyword rows.
		v.union([KeywordWithCluster, KeywordWithoutCluster]),
	),
});
