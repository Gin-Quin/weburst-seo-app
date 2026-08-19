import * as v from "valibot";

// Shared enums/schemas
export const ProjectType = v.union([
	v.literal("audit"),
	v.literal("prospect"),
	v.literal("monthly_subscription"),
]);
export type ProjectType = v.InferOutput<typeof ProjectType>;

export const ArticleLimit = v.pipe(v.number(), v.integer(), v.minValue(0));

export const KeywordAnalysisFrequency = v.union([
	v.literal("1/day"),
	v.literal("1/week"),
	v.literal("1/month"),
	v.literal("2/month"),
]);
export type KeywordAnalysisFrequency = v.InferOutput<typeof KeywordAnalysisFrequency>;

// createProject(input: ProjectInsert)
export const CreateProject = v.object({
	id: v.string(),
	clientName: v.optional(v.string(), ""),
	clientId: v.optional(v.string()),
	domain: v.string(),
	websiteUrl: v.string(),
	type: ProjectType,
	keywordAnalysisFrequency: KeywordAnalysisFrequency,
	articleLimit: ArticleLimit,
	leaderIds: v.optional(v.array(v.string()), []),
	projectManagerIds: v.optional(v.array(v.string())),
});
export type CreateProject = v.InferOutput<typeof CreateProject>;

// getProjectById(id: string)
export const GetProjectById = v.string();
export type GetProjectById = v.InferOutput<typeof GetProjectById>;

// updateProject(id: string, updates: ProjectUpdate)
export const ProjectUpdate = v.partial(
	v.object({
		clientName: v.string(),
		clientId: v.string(),
		domain: v.string(),
		websiteUrl: v.string(),
		type: ProjectType,
		keywordAnalysisFrequency: KeywordAnalysisFrequency,
		articleLimit: ArticleLimit,
		leaderIds: v.array(v.string()),
		projectManagerIds: v.array(v.string()),
	}),
);
export type ProjectUpdate = v.InferOutput<typeof ProjectUpdate>;

// Tuple schema to preserve the exact parameter list [id, updates]
export const UpdateProject = v.tuple([v.string(), ProjectUpdate]);
export type UpdateProject = v.InferOutput<typeof UpdateProject>;

// deleteProject(id: string)
export const DeleteProject = v.string();
export type DeleteProject = v.InferOutput<typeof DeleteProject>;
