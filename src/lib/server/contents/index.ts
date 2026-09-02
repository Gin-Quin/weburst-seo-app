import {
	contentHtmlToText,
	createInitialArticleHtml,
	sanitizeContentHtml,
} from "$lib/contents/articleHtml";
import { db } from "$lib/server/db";
import {
	contents,
	contentVersions,
	type Content,
	type ContentPriority,
	type ContentStatus,
	type ContentVersion,
} from "$lib/server/db/schema";
import {
	analyzeSerpmanticsContent,
	createSerpmanticsGuide,
	getSerpmanticsGuide,
	type SerpmanticsContentAnalysis,
	type SerpmanticsGuide,
} from "$lib/server/serpmantics";
import { createId } from "@paralleldrive/cuid2";
import { and, count, desc, eq, isNotNull, isNull, max } from "drizzle-orm";
import { importArticleFromUrl } from "./importArticle";
import { loadContentChatMessages, upsertContentChatMessages } from "./contentChats";
import { CONTENT_QUOTA_EXCEEDED_MESSAGE, isContentQuotaReached } from "./quota";

export type ContentDetail = Omit<
	Content,
	"serpmanticsGuideJson" | "serpmanticsAnalysisJson" | "chatMessagesJson"
> & {
	serpmanticsGuide: SerpmanticsGuide | null;
	serpmanticsAnalysis: SerpmanticsContentAnalysis | null;
	chatMessages: unknown[];
};

export type ContentVersionDetail = Omit<
	ContentVersion,
	"serpmanticsGuideJson" | "serpmanticsAnalysisJson"
> & {
	serpmanticsGuide: SerpmanticsGuide | null;
	serpmanticsAnalysis: SerpmanticsContentAnalysis | null;
};

export type CreateContentInput = {
	projectId: string;
	title: string;
	cluster?: string;
	priority?: ContentPriority;
	existingUrl?: string;
	brief: string;
};

export async function listProjectContents(
	projectId: string,
	archived: boolean,
): Promise<ContentDetail[]> {
	const rows = await db
		.select()
		.from(contents)
		.where(
			and(
				eq(contents.projectId, projectId),
				archived ? isNotNull(contents.archivedAt) : isNull(contents.archivedAt),
			),
		)
		.orderBy(desc(contents.updatedAt));
	return rows.map((row) => toContentDetail(row));
}

export async function countProjectContents(projectId: string): Promise<number> {
	const [row] = await db
		.select({ value: count() })
		.from(contents)
		.where(eq(contents.projectId, projectId));
	return row?.value ?? 0;
}

export async function createContent(
	input: CreateContentInput,
	options: { maxContents?: number } = {},
): Promise<ContentDetail> {
	const id = createId();
	if (options.maxContents !== undefined) {
		const [row] = await db
			.select({ value: count() })
			.from(contents)
			.where(eq(contents.projectId, input.projectId));
		if (isContentQuotaReached(row?.value ?? 0, options.maxContents)) {
			throw new Error(CONTENT_QUOTA_EXCEEDED_MESSAGE);
		}
	}

	const existingUrl = emptyToNull(input.existingUrl);
	const contentHtml = existingUrl
		? await importArticleFromUrl(existingUrl)
		: createInitialArticleHtml(input.title);
	const now = Date.now();
	await db.transaction(async (tx) => {
		if (options.maxContents !== undefined) {
			const [row] = await tx
				.select({ value: count() })
				.from(contents)
				.where(eq(contents.projectId, input.projectId));
			if (isContentQuotaReached(row?.value ?? 0, options.maxContents)) {
				throw new Error(CONTENT_QUOTA_EXCEEDED_MESSAGE);
			}
		}

		await tx.insert(contents).values({
			id,
			projectId: input.projectId,
			title: input.title.trim(),
			cluster: emptyToNull(input.cluster),
			priority: input.priority,
			existingUrl,
			brief: input.brief.trim(),
			contentHtml,
			contentText: contentHtmlToText(contentHtml),
			createdAt: now,
			updatedAt: now,
		});
	});

	try {
		const guideId = await createSerpmanticsGuide(input.title.trim());
		await db
			.update(contents)
			.set({ serpmanticsGuideId: guideId, serpmanticsStatus: "pending", updatedAt: Date.now() })
			.where(eq(contents.id, id));
	} catch (error) {
		await db
			.update(contents)
			.set({
				serpmanticsStatus: "failed",
				serpmanticsError: errorMessage(error),
				updatedAt: Date.now(),
			})
			.where(eq(contents.id, id));
	}

	return getContentById(id, input.projectId);
}

export async function getContentById(
	id: string,
	projectId: string,
	options: { chatUserId?: string } = {},
): Promise<ContentDetail> {
	const row = await getContentRow(id, projectId);
	const chatMessages = options.chatUserId
		? await loadContentChatMessages(db, id, options.chatUserId)
		: [];
	return toContentDetail(row, chatMessages);
}

export async function saveContentDraft(input: {
	id: string;
	projectId: string;
	contentHtml: string;
	contentJson: string;
}): Promise<ContentDetail> {
	await getContentRow(input.id, input.projectId);
	const contentHtml = sanitizeContentHtml(input.contentHtml);
	const contentJson = validateDocumentJson(input.contentJson);
	await db
		.update(contents)
		.set({
			contentHtml,
			contentText: contentHtmlToText(contentHtml),
			contentJson,
			status: "in_progress",
			updatedAt: Date.now(),
		})
		.where(eq(contents.id, input.id));
	return getContentById(input.id, input.projectId);
}

export async function updateContentBrief(input: {
	id: string;
	projectId: string;
	brief: string;
}): Promise<ContentDetail> {
	await getContentRow(input.id, input.projectId);
	await db
		.update(contents)
		.set({ brief: input.brief.trim(), updatedAt: Date.now() })
		.where(eq(contents.id, input.id));
	return getContentById(input.id, input.projectId);
}

export async function updateContent(input: {
	id: string;
	projectId: string;
	title: string;
	cluster: string;
	priority: ContentPriority | null;
	brief: string;
	chatMemory: string;
}): Promise<ContentDetail> {
	const existing = await getContentRow(input.id, input.projectId);
	const brief = input.brief.trim();
	await db
		.update(contents)
		.set({
			title: input.title.trim(),
			cluster: emptyToNull(input.cluster),
			priority: input.priority,
			brief,
			chatMemory: input.chatMemory.trim(),
			updatedAt: Date.now(),
		})
		.where(and(eq(contents.id, input.id), eq(contents.projectId, input.projectId)));

	if (brief !== existing.brief) {
		try {
			await refreshContentOptimization(input.id, input.projectId);
		} catch {
			// Metadata remains saved when the external analysis is unavailable.
		}
	}

	return getContentById(input.id, input.projectId);
}

export async function setContentStatus(input: {
	id: string;
	projectId: string;
	status: ContentStatus;
}): Promise<void> {
	await getContentRow(input.id, input.projectId);
	await db
		.update(contents)
		.set({ status: input.status, updatedAt: Date.now() })
		.where(eq(contents.id, input.id));
}

export async function setContentArchived(input: {
	id: string;
	projectId: string;
	archived: boolean;
}): Promise<void> {
	await getContentRow(input.id, input.projectId);
	await db
		.update(contents)
		.set({ archivedAt: input.archived ? Date.now() : null, updatedAt: Date.now() })
		.where(eq(contents.id, input.id));
}

export async function refreshContentOptimization(
	id: string,
	projectId: string,
): Promise<ContentDetail> {
	const content = await getContentRow(id, projectId);
	if (!content.serpmanticsGuideId) {
		throw new Error(
			publicAnalysisError(content.serpmanticsError) ?? "Aucune analyse SEO n’est associée.",
		);
	}

	try {
		const guideState = await getSerpmanticsGuide(content.serpmanticsGuideId);
		if (guideState.state === "pending") {
			await db
				.update(contents)
				.set({ serpmanticsStatus: "pending", serpmanticsError: null })
				.where(eq(contents.id, id));
			return getContentById(id, projectId);
		}
		if (guideState.state === "failed") {
			await db
				.update(contents)
				.set({
					serpmanticsStatus: "failed",
					serpmanticsError: guideState.error,
					serpmanticsGuideJson: guideState.guide
						? JSON.stringify(guideState.guide)
						: content.serpmanticsGuideJson,
				})
				.where(eq(contents.id, id));
			return getContentById(id, projectId);
		}

		const analysis = await analyzeSerpmanticsContent(
			content.serpmanticsGuideId,
			content.contentHtml,
		);
		await db
			.update(contents)
			.set({
				serpmanticsStatus: "ready",
				serpmanticsError: null,
				serpmanticsGuideJson: JSON.stringify(guideState.guide),
				serpmanticsAnalysisJson: JSON.stringify(analysis),
				score: analysis.score,
			})
			.where(eq(contents.id, id));
		return getContentById(id, projectId);
	} catch (error) {
		await db
			.update(contents)
			.set({ serpmanticsError: errorMessage(error) })
			.where(eq(contents.id, id));
		throw error;
	}
}

export async function refreshContentOptimizationScore(
	id: string,
	projectId: string,
): Promise<ContentDetail> {
	const content = await getContentRow(id, projectId);
	if (!content.serpmanticsGuideId) {
		throw new Error(
			publicAnalysisError(content.serpmanticsError) ?? "Aucune analyse SEO n’est associée.",
		);
	}

	try {
		const analysis = await analyzeSerpmanticsContent(
			content.serpmanticsGuideId,
			content.contentHtml,
		);
		await db
			.update(contents)
			.set({
				serpmanticsStatus: "ready",
				serpmanticsError: null,
				serpmanticsAnalysisJson: JSON.stringify(analysis),
				score: analysis.score,
			})
			.where(eq(contents.id, id));
		return getContentById(id, projectId);
	} catch (error) {
		await db
			.update(contents)
			.set({ serpmanticsError: errorMessage(error) })
			.where(eq(contents.id, id));
		throw error;
	}
}

export async function retrySerpmanticsGuide(id: string, projectId: string): Promise<ContentDetail> {
	const content = await getContentRow(id, projectId);
	const guideId = await createSerpmanticsGuide(content.title);
	await db
		.update(contents)
		.set({
			serpmanticsGuideId: guideId,
			serpmanticsStatus: "pending",
			serpmanticsError: null,
			serpmanticsGuideJson: null,
			serpmanticsAnalysisJson: null,
			score: null,
		})
		.where(eq(contents.id, id));
	return getContentById(id, projectId);
}

export async function listContentVersions(
	contentId: string,
	projectId: string,
): Promise<ContentVersionDetail[]> {
	await getContentRow(contentId, projectId);
	const rows = await db
		.select()
		.from(contentVersions)
		.where(eq(contentVersions.contentId, contentId))
		.orderBy(desc(contentVersions.version));
	return rows.map(toVersionDetail);
}

export async function createContentVersion(
	contentId: string,
	projectId: string,
): Promise<ContentVersionDetail> {
	const content = await getContentRow(contentId, projectId);
	const [lastVersion] = await db
		.select({ version: max(contentVersions.version) })
		.from(contentVersions)
		.where(eq(contentVersions.contentId, contentId));
	const version = (lastVersion?.version ?? 0) + 1;
	const id = createId();
	await db.insert(contentVersions).values({
		id,
		contentId,
		version,
		title: content.title,
		brief: content.brief,
		contentHtml: content.contentHtml,
		contentText: content.contentText,
		contentJson: content.contentJson,
		score: content.score,
		serpmanticsGuideJson: content.serpmanticsGuideJson,
		serpmanticsAnalysisJson: content.serpmanticsAnalysisJson,
	});
	const [saved] = await db.select().from(contentVersions).where(eq(contentVersions.id, id));
	if (!saved) throw new Error("Version introuvable après sauvegarde.");
	return toVersionDetail(saved);
}

export async function restoreContentVersion(input: {
	contentId: string;
	projectId: string;
	versionId: string;
}): Promise<ContentDetail> {
	await getContentRow(input.contentId, input.projectId);
	const [version] = await db
		.select()
		.from(contentVersions)
		.where(
			and(eq(contentVersions.id, input.versionId), eq(contentVersions.contentId, input.contentId)),
		);
	if (!version) throw new Error("Version introuvable.");
	await db
		.update(contents)
		.set({
			title: version.title,
			brief: version.brief,
			contentHtml: version.contentHtml,
			contentText: version.contentText,
			contentJson: version.contentJson,
			score: version.score,
			serpmanticsGuideJson: version.serpmanticsGuideJson,
			serpmanticsAnalysisJson: version.serpmanticsAnalysisJson,
			status: "in_progress",
			updatedAt: Date.now(),
		})
		.where(eq(contents.id, input.contentId));
	return getContentById(input.contentId, input.projectId);
}

export async function saveContentChatMessages(
	id: string,
	projectId: string,
	userId: string,
	messages: unknown[],
): Promise<void> {
	await getContentRow(id, projectId);
	await upsertContentChatMessages(db, id, userId, messages);
}

export async function replaceContentFromChat(input: {
	id: string;
	projectId: string;
	html: string;
}): Promise<ContentDetail> {
	const current = await getContentRow(input.id, input.projectId);
	const html = sanitizeContentHtml(input.html);
	await db
		.update(contents)
		.set({
			contentHtml: html,
			contentText: contentHtmlToText(html),
			contentJson: current.contentJson,
			status: "in_progress",
			updatedAt: Date.now(),
		})
		.where(eq(contents.id, input.id));
	return getContentById(input.id, input.projectId);
}

async function getContentRow(id: string, projectId: string): Promise<Content> {
	const [content] = await db
		.select()
		.from(contents)
		.where(and(eq(contents.id, id), eq(contents.projectId, projectId)));
	if (!content) throw new Error("Contenu introuvable.");
	return content;
}

function toContentDetail(content: Content, chatMessages: unknown[] = []): ContentDetail {
	const { serpmanticsGuideJson, serpmanticsAnalysisJson, chatMessagesJson, ...rest } = content;
	return {
		...rest,
		serpmanticsError: publicAnalysisError(rest.serpmanticsError),
		serpmanticsGuide: parseJson<SerpmanticsGuide>(serpmanticsGuideJson),
		serpmanticsAnalysis: parseJson<SerpmanticsContentAnalysis>(serpmanticsAnalysisJson),
		chatMessages,
	};
}

function toVersionDetail(version: ContentVersion): ContentVersionDetail {
	const { serpmanticsGuideJson, serpmanticsAnalysisJson, ...rest } = version;
	return {
		...rest,
		serpmanticsGuide: parseJson<SerpmanticsGuide>(serpmanticsGuideJson),
		serpmanticsAnalysis: parseJson<SerpmanticsContentAnalysis>(serpmanticsAnalysisJson),
	};
}

function parseJson<T>(value: string | null): T | null {
	if (!value) return null;
	try {
		return JSON.parse(value) as T;
	} catch {
		return null;
	}
}

function emptyToNull(value: string | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

function validateDocumentJson(value: string): string {
	try {
		const parsed = JSON.parse(value) as { type?: string };
		if (parsed.type !== "doc") throw new Error();
		return JSON.stringify(parsed);
	} catch {
		throw new Error("Document ProseMirror invalide.");
	}
}

function errorMessage(error: unknown): string {
	return (
		publicAnalysisError(error instanceof Error ? error.message : null) ??
		"Une erreur inattendue est survenue."
	);
}

function publicAnalysisError(message: string | null): string | null {
	return message?.replace(/serp\s*mantics/giu, "le service d’analyse SEO") ?? null;
}
