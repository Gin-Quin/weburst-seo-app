import {
	MAX_CHAT_MEMORY_LENGTH,
	MAX_MEMORY_ENTRY_LENGTH,
} from "$lib/contents/chatMemory";
import { and, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "../db/schema";
import { clients, contents } from "../db/schema";

type ChatMemoryDatabase = LibSQLDatabase<typeof schema>;

export type ClientChatContext = {
	context: string;
	memory: string;
};

export async function loadClientChatContext(
	database: ChatMemoryDatabase,
	clientId: string | null,
): Promise<ClientChatContext> {
	if (!clientId) return { context: "", memory: "" };
	const [client] = await database
		.select({ context: clients.context, memory: clients.chatMemory })
		.from(clients)
		.where(eq(clients.id, clientId))
		.limit(1);
	return client ?? { context: "", memory: "" };
}

export async function loadClientChatMemory(
	database: ChatMemoryDatabase,
	clientId: string | null,
): Promise<string> {
	return (await loadClientChatContext(database, clientId)).memory;
}

export async function appendContentChatMemory(
	database: ChatMemoryDatabase,
	input: { contentId: string; projectId: string; information: string },
): Promise<string> {
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const [content] = await database
			.select({ chatMemory: contents.chatMemory })
			.from(contents)
			.where(and(eq(contents.id, input.contentId), eq(contents.projectId, input.projectId)))
			.limit(1);
		if (!content) throw new Error("Contenu introuvable.");

		const nextMemory = appendMemory(content.chatMemory, input.information);
		if (nextMemory === content.chatMemory) return nextMemory;
		const [updated] = await database
			.update(contents)
			.set({ chatMemory: nextMemory, updatedAt: Date.now() })
			.where(
				and(
					eq(contents.id, input.contentId),
					eq(contents.projectId, input.projectId),
					eq(contents.chatMemory, content.chatMemory),
				),
			)
			.returning({ chatMemory: contents.chatMemory });
		if (updated) return updated.chatMemory;
	}
	throw new Error("La mémoire du contenu a été modifiée simultanément. Réessaie.");
}

export async function appendClientChatMemory(
	database: ChatMemoryDatabase,
	input: { clientId: string; information: string },
): Promise<string> {
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const [client] = await database
			.select({ chatMemory: clients.chatMemory })
			.from(clients)
			.where(eq(clients.id, input.clientId))
			.limit(1);
		if (!client) throw new Error("Client introuvable.");

		const nextMemory = appendMemory(client.chatMemory, input.information);
		if (nextMemory === client.chatMemory) return nextMemory;
		const [updated] = await database
			.update(clients)
			.set({ chatMemory: nextMemory, updatedAt: Date.now() })
			.where(and(eq(clients.id, input.clientId), eq(clients.chatMemory, client.chatMemory)))
			.returning({ chatMemory: clients.chatMemory });
		if (updated) return updated.chatMemory;
	}
	throw new Error("La mémoire du client a été modifiée simultanément. Réessaie.");
}

export function appendMemory(currentMemory: string, information: string): string {
	const current = currentMemory.trim();
	const entry = cleanMemoryEntry(information);
	if (!entry) throw new Error("L’information à mémoriser est vide.");
	if (entry.length > MAX_MEMORY_ENTRY_LENGTH) {
		throw new Error(`Une information mémorisée ne peut pas dépasser ${MAX_MEMORY_ENTRY_LENGTH} caractères.`);
	}

	const normalizedEntry = normalizeMemoryEntry(entry);
	const alreadySaved = current
		.split("\n")
		.map(normalizeMemoryEntry)
		.some((existing) => existing === normalizedEntry);
	if (alreadySaved) return current;

	const nextMemory = current ? `${current}\n- ${entry}` : `- ${entry}`;
	if (nextMemory.length > MAX_CHAT_MEMORY_LENGTH) {
		throw new Error(`La mémoire ne peut pas dépasser ${MAX_CHAT_MEMORY_LENGTH} caractères.`);
	}
	return nextMemory;
}

function cleanMemoryEntry(value: string): string {
	return value.replace(/^\s*[-*]\s*/, "").replace(/\s+/g, " ").trim();
}

function normalizeMemoryEntry(value: string): string {
	return cleanMemoryEntry(value).toLocaleLowerCase("fr-FR");
}
