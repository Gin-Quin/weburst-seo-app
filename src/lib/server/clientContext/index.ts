import { and, eq, inArray } from "drizzle-orm";
import { MAX_CHAT_MEMORY_LENGTH } from "$lib/contents/chatMemory";
import { db } from "$lib/server/db";
import { clientContextFiles, clients } from "$lib/server/db/schema";
import { MAX_CLIENT_CONTEXT_FILES, MAX_CLIENT_CONTEXT_LENGTH } from "./validation";

export type ClientContextFileInfo = {
	id: string;
	name: string;
	mimeType: string;
	size: number;
	createdAt: number;
};

export type NewClientContextFile = {
	name: string;
	mimeType: string;
	size: number;
	content: string;
};

const fileInfoSelection = {
	id: clientContextFiles.id,
	name: clientContextFiles.name,
	mimeType: clientContextFiles.mimeType,
	size: clientContextFiles.size,
	createdAt: clientContextFiles.createdAt,
};

export async function getClientContext(clientId: string): Promise<{
	context: string;
	chatMemory: string;
	files: ClientContextFileInfo[];
} | null> {
	const [client] = await db
		.select({ context: clients.context, chatMemory: clients.chatMemory })
		.from(clients)
		.where(eq(clients.id, clientId))
		.limit(1);
	if (!client) return null;

	const files = await db
		.select(fileInfoSelection)
		.from(clientContextFiles)
		.where(eq(clientContextFiles.clientId, clientId))
		.orderBy(clientContextFiles.createdAt);
	return { context: client.context, chatMemory: client.chatMemory, files };
}

export async function saveClientContext(input: {
	clientId: string;
	context: string;
	chatMemory: string;
	deletedFileIds: string[];
	newFiles: NewClientContextFile[];
}): Promise<{ context: string; chatMemory: string; files: ClientContextFileInfo[] }> {
	if (input.context.length > MAX_CLIENT_CONTEXT_LENGTH) {
		throw new Error("Le contexte ne peut pas dépasser 50 000 caractères.");
	}
	if (input.chatMemory.length > MAX_CHAT_MEMORY_LENGTH) {
		throw new Error(`La mémoire ne peut pas dépasser ${MAX_CHAT_MEMORY_LENGTH} caractères.`);
	}

	const uniqueDeletedIds = [...new Set(input.deletedFileIds)];
	const existingFiles = await db
		.select({ id: clientContextFiles.id })
		.from(clientContextFiles)
		.where(eq(clientContextFiles.clientId, input.clientId));
	const existingIds = new Set(existingFiles.map(({ id }) => id));
	const deletedCount = uniqueDeletedIds.filter((id) => existingIds.has(id)).length;
	if (existingFiles.length - deletedCount + input.newFiles.length > MAX_CLIENT_CONTEXT_FILES) {
		throw new Error(`Vous pouvez conserver au maximum ${MAX_CLIENT_CONTEXT_FILES} fichiers.`);
	}

	await db.transaction(async (tx) => {
		const [updated] = await tx
			.update(clients)
			.set({
				context: input.context,
				chatMemory: input.chatMemory.trim(),
				updatedAt: Date.now(),
			})
			.where(eq(clients.id, input.clientId))
			.returning({ id: clients.id });
		if (!updated) throw new Error("Client introuvable.");

		if (uniqueDeletedIds.length > 0) {
			await tx
				.delete(clientContextFiles)
				.where(
					and(
						eq(clientContextFiles.clientId, input.clientId),
						inArray(clientContextFiles.id, uniqueDeletedIds),
					),
				);
		}

		if (input.newFiles.length > 0) {
			await tx.insert(clientContextFiles).values(
				input.newFiles.map((file) => ({
					id: crypto.randomUUID(),
					clientId: input.clientId,
					...file,
				})),
			);
		}
	});

	return (await getClientContext(input.clientId))!;
}

export async function getClientContextFile(clientId: string, fileId: string) {
	const [file] = await db
		.select()
		.from(clientContextFiles)
		.where(and(eq(clientContextFiles.clientId, clientId), eq(clientContextFiles.id, fileId)))
		.limit(1);
	return file ?? null;
}
