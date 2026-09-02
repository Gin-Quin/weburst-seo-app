import { canAccessClient, requireClientAccess } from "$lib/server/auth/authorization";
import { MAX_CHAT_MEMORY_LENGTH } from "$lib/contents/chatMemory";
import { getClientContext, saveClientContext } from "$lib/server/clientContext";
import {
	extractClientContextFileText,
	PdfTextExtractionError,
} from "$lib/server/clientContext/extractText";
import {
	getContextFileExtension,
	MAX_CLIENT_CONTEXT_LENGTH,
	validateContextUpload,
} from "$lib/server/clientContext/validation";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getRequestUser } from "../../../utilities";

const DEFAULT_MIME_TYPES = {
	txt: "text/plain",
	md: "text/markdown",
	pdf: "application/pdf",
} as const;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const user = await getRequestUser();
		await requireClientAccess(user, params.clientId, "view");
		const result = await getClientContext(params.clientId);
		if (!result) return json({ message: "Client introuvable." }, { status: 404 });
		const canEdit = await canAccessClient(user!, params.clientId, "manage");
		return json({
			...result,
			chatMemory: canEdit ? result.chatMemory : undefined,
			canEdit,
		});
	} catch (error) {
		return handleError(error);
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		await requireClientAccess(await getRequestUser(), params.clientId, "manage");
		const formData = await request.formData();
		const context = formData.get("context");
		if (typeof context !== "string") throw new Error("Le contexte est invalide.");
		if (context.length > MAX_CLIENT_CONTEXT_LENGTH) {
			throw new Error("Le contexte ne peut pas dépasser 50 000 caractères.");
		}
		const chatMemory = formData.get("chatMemory");
		if (typeof chatMemory !== "string") throw new Error("La mémoire est invalide.");
		if (chatMemory.length > MAX_CHAT_MEMORY_LENGTH) {
			throw new Error(`La mémoire ne peut pas dépasser ${MAX_CHAT_MEMORY_LENGTH} caractères.`);
		}

		const deletedFileIds = parseDeletedFileIds(formData.get("deletedFileIds"));
		const files = formData
			.getAll("files")
			.filter((entry): entry is File => entry instanceof File && entry.size > 0);
		validateContextUpload(files);

		const newFiles = await Promise.all(
			files.map(async (file) => {
				const extension = getContextFileExtension(file.name)!;
				const data = new Uint8Array(await file.arrayBuffer());
				return {
					name: file.name,
					mimeType: file.type || DEFAULT_MIME_TYPES[extension],
					size: file.size,
					content: await extractClientContextFileText({
						name: file.name,
						extension,
						data,
					}),
				};
			}),
		);

		return json(
			await saveClientContext({
				clientId: params.clientId,
				context,
				chatMemory,
				deletedFileIds,
				newFiles,
			}),
		);
	} catch (error) {
		return handleError(error);
	}
};

function parseDeletedFileIds(value: FormDataEntryValue | null): string[] {
	if (typeof value !== "string") return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		throw new Error("La liste des fichiers supprimés est invalide.");
	}
	if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== "string")) {
		throw new Error("La liste des fichiers supprimés est invalide.");
	}
	return parsed;
}

function handleError(error: unknown) {
	const message = error instanceof Error ? error.message : "Une erreur est survenue.";
	const status =
		error instanceof PdfTextExtractionError ? error.status : message === "Unauthorized" ? 403 : 400;
	return json({ message }, { status });
}
