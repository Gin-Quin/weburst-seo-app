import { and, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "../db/schema";
import { contentChats } from "../db/schema";

type ContentChatDatabase = LibSQLDatabase<typeof schema>;

export async function loadContentChatMessages(
	database: ContentChatDatabase,
	contentId: string,
	userId: string,
): Promise<unknown[]> {
	const [chat] = await database
		.select({ messagesJson: contentChats.messagesJson })
		.from(contentChats)
		.where(and(eq(contentChats.contentId, contentId), eq(contentChats.userId, userId)));
	return parseMessages(chat?.messagesJson);
}

export async function upsertContentChatMessages(
	database: ContentChatDatabase,
	contentId: string,
	userId: string,
	messages: unknown[],
): Promise<void> {
	const now = Date.now();
	const messagesJson = JSON.stringify(messages);
	await database
		.insert(contentChats)
		.values({ contentId, userId, messagesJson, createdAt: now, updatedAt: now })
		.onConflictDoUpdate({
			target: [contentChats.contentId, contentChats.userId],
			set: { messagesJson, updatedAt: now },
		});
}

function parseMessages(value: string | undefined): unknown[] {
	if (!value) return [];
	try {
		const parsed: unknown = JSON.parse(value);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}
