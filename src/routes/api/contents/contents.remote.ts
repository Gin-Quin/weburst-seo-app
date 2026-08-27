import { command, query } from "$app/server";
import { canViewProjectContents } from "$lib/contents/access";
import { requireProjectAccess } from "$lib/server/auth/authorization";
import {
	createContent as createContentService,
	createContentVersion as createContentVersionService,
	getContentById,
	listContentVersions as listContentVersionsService,
	listProjectContents,
	refreshContentOptimization,
	restoreContentVersion as restoreContentVersionService,
	retrySerpmanticsGuide,
	saveContentChatMessages,
	saveContentDraft,
	setContentArchived,
	setContentStatus,
	updateContentBrief,
} from "$lib/server/contents";
import { getContentCreationPolicy } from "$lib/server/contents/quota";
import { getRequestUser } from "../utilities";
import {
	ContentIdentity,
	CreateContent,
	ListContents,
	RestoreVersion,
	SaveDraft,
	SetArchived,
	SetStatus,
	UpdateBrief,
} from "./contents.schema";

export const listContents = query(ListContents, async ({ projectId, archived }) => {
	await requireContentsViewAccess(projectId);
	return listProjectContents(projectId, archived);
});

export const getContent = query(ContentIdentity, async ({ projectId, id }) => {
	await requireContentsViewAccess(projectId);
	return getContentById(id, projectId);
});

export const createContent = command(CreateContent, async (input) => {
	const user = await getRequestUser();
	if (!user) throw new Error("Unauthorized");
	const project = await requireProjectAccess(
		user,
		input.projectId,
		user.role === "client" ? "view" : "manage",
	);
	const policy = getContentCreationPolicy(user.role, project);
	if (!policy.allowed) throw new Error("Unauthorized");
	const created = await createContentService(input, {
		maxContents: policy.limit ?? undefined,
	});
	await listContents({ projectId: input.projectId, archived: false }).refresh();
	return created;
});

export const saveDraft = command(SaveDraft, async (input) => {
	await requireProjectAccess(await getRequestUser(), input.projectId, "manage");
	return saveContentDraft(input);
});

export const updateBrief = command(UpdateBrief, async (input) => {
	await requireProjectAccess(await getRequestUser(), input.projectId, "manage");
	return updateContentBrief(input);
});

export const updateStatus = command(SetStatus, async (input) => {
	await requireProjectAccess(await getRequestUser(), input.projectId, "manage");
	await setContentStatus(input);
	await listContents({ projectId: input.projectId, archived: false }).refresh();
});

export const archiveContent = command(SetArchived, async (input) => {
	await requireProjectAccess(await getRequestUser(), input.projectId, "manage");
	await setContentArchived(input);
	await Promise.all([
		listContents({ projectId: input.projectId, archived: false }).refresh(),
		listContents({ projectId: input.projectId, archived: true }).refresh(),
	]);
});

export const refreshOptimization = command(ContentIdentity, async ({ projectId, id }) => {
	await requireContentsViewAccess(projectId);
	return refreshContentOptimization(id, projectId);
});

export const retryOptimizationGuide = command(ContentIdentity, async ({ projectId, id }) => {
	await requireProjectAccess(await getRequestUser(), projectId, "manage");
	return retrySerpmanticsGuide(id, projectId);
});

export const listVersions = query(ContentIdentity, async ({ projectId, id }) => {
	await requireContentsViewAccess(projectId);
	return listContentVersionsService(id, projectId);
});

export const createVersion = command(ContentIdentity, async ({ projectId, id }) => {
	await requireProjectAccess(await getRequestUser(), projectId, "manage");
	const version = await createContentVersionService(id, projectId);
	await listVersions({ projectId, id }).refresh();
	return version;
});

export const restoreVersion = command(RestoreVersion, async (input) => {
	await requireProjectAccess(await getRequestUser(), input.projectId, "manage");
	return restoreContentVersionService(input);
});

export const clearContentChat = command(ContentIdentity, async ({ projectId, id }) => {
	await requireProjectAccess(await getRequestUser(), projectId, "manage");
	await saveContentChatMessages(id, projectId, []);
});

async function requireContentsViewAccess(projectId: string) {
	const user = await getRequestUser();
	if (!user) throw new Error("Unauthorized");
	const project = await requireProjectAccess(user, projectId, "view");
	if (!canViewProjectContents(user.role, project.type)) throw new Error("Unauthorized");
	return project;
}
