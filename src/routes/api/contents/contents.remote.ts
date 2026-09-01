import { command, query } from "$app/server";
import { canViewProjectContents } from "$lib/contents/access";
import { requireProjectAccess } from "$lib/server/auth/authorization";
import {
	countProjectContents,
	createContent as createContentService,
	createContentVersion as createContentVersionService,
	getContentById,
	listContentVersions as listContentVersionsService,
	listProjectContents,
	refreshContentOptimization,
	refreshContentOptimizationScore,
	restoreContentVersion as restoreContentVersionService,
	retrySerpmanticsGuide,
	saveContentChatMessages,
	saveContentDraft,
	setContentArchived,
	setContentStatus,
	updateContent as updateContentService,
	updateContentBrief,
} from "$lib/server/contents";
import {
	getContentCreationPolicy,
	getRemainingContentQuota,
	shouldSendContentQuotaWarning,
} from "$lib/server/contents/quota";
import { sendContentQuotaWarningEmail } from "$lib/server/email/contentQuota";
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
	UpdateContent,
} from "./contents.schema";

export const listContents = query(ListContents, async ({ projectId, archived }) => {
	await requireContentsViewAccess(projectId);
	return listProjectContents(projectId, archived);
});

export const getContent = query(ContentIdentity, async ({ projectId, id }) => {
	const { user } = await requireContentsViewAccess(projectId);
	return getContentById(id, projectId, { chatUserId: user.id });
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
	if (policy.limit !== null) {
		const currentCount = await countProjectContents(input.projectId);
		const remaining = getRemainingContentQuota(currentCount, policy.limit);
		if (shouldSendContentQuotaWarning(remaining)) {
			try {
				await sendContentQuotaWarningEmail(user.email, remaining);
			} catch (error) {
				console.error("Failed to send content quota warning email", {
					userId: user.id,
					projectId: input.projectId,
					remaining,
					error,
				});
			}
		}
	}
	await listContents({ projectId: input.projectId, archived: false }).refresh();
	return created;
});

export const updateContent = command(UpdateContent, async (input) => {
	await requireProjectAccess(await getRequestUser(), input.projectId, "manage");
	const updated = await updateContentService(input);
	await Promise.all([
		getContent({ projectId: input.projectId, id: input.id }).refresh(),
		listContents({ projectId: input.projectId, archived: false }).refresh(),
		listContents({ projectId: input.projectId, archived: true }).refresh(),
	]);
	return updated;
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

export const refreshOptimizationScore = command(ContentIdentity, async ({ projectId, id }) => {
	await requireProjectAccess(await getRequestUser(), projectId, "manage");
	return refreshContentOptimizationScore(id, projectId);
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
	const user = await getRequestUser();
	await requireProjectAccess(user, projectId, "manage");
	if (!user) throw new Error("Unauthorized");
	await saveContentChatMessages(id, projectId, user.id, []);
});

async function requireContentsViewAccess(projectId: string) {
	const user = await getRequestUser();
	if (!user) throw new Error("Unauthorized");
	const project = await requireProjectAccess(user, projectId, "view");
	if (!canViewProjectContents(user.role, project.type)) throw new Error("Unauthorized");
	return { project, user };
}
