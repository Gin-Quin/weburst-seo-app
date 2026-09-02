import * as v from "valibot";
import { MAX_CHAT_MEMORY_LENGTH } from "$lib/contents/chatMemory";

const Id = v.pipe(v.string(), v.trim(), v.minLength(1));
const Title = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(240));
const OptionalText = v.optional(v.pipe(v.string(), v.maxLength(20_000)));

export const ContentPriority = v.union([
	v.literal("high"),
	v.literal("moderate"),
	v.literal("low"),
]);

export const ContentStatus = v.union([
	v.literal("new"),
	v.literal("in_progress"),
	v.literal("done"),
]);

export const ListContents = v.object({
	projectId: Id,
	archived: v.optional(v.boolean(), false),
});

export const ContentIdentity = v.object({ projectId: Id, id: Id });

export const CreateContent = v.object({
	projectId: Id,
	title: Title,
	cluster: OptionalText,
	priority: v.optional(ContentPriority),
	existingUrl: v.optional(v.pipe(v.string(), v.maxLength(2_048))),
	brief: v.optional(v.pipe(v.string(), v.maxLength(50_000)), ""),
});

export const UpdateContent = v.object({
	projectId: Id,
	id: Id,
	title: Title,
	cluster: v.pipe(v.string(), v.maxLength(20_000)),
	priority: v.nullable(ContentPriority),
	brief: v.pipe(v.string(), v.maxLength(50_000)),
	chatMemory: v.pipe(v.string(), v.maxLength(MAX_CHAT_MEMORY_LENGTH)),
});

export const SaveDraft = v.object({
	projectId: Id,
	id: Id,
	contentHtml: v.pipe(v.string(), v.maxLength(2_000_000)),
	contentJson: v.pipe(v.string(), v.maxLength(2_000_000)),
});

export const UpdateBrief = v.object({
	projectId: Id,
	id: Id,
	brief: v.pipe(v.string(), v.maxLength(50_000)),
});

export const SetArchived = v.object({
	projectId: Id,
	id: Id,
	archived: v.boolean(),
});

export const SetStatus = v.object({
	projectId: Id,
	id: Id,
	status: ContentStatus,
});

export const RestoreVersion = v.object({
	projectId: Id,
	contentId: Id,
	versionId: Id,
});
