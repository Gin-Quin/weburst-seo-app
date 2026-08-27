import { requireClientAccess } from "$lib/server/auth/authorization";
import { getClientContextFile } from "$lib/server/clientContext";
import type { RequestHandler } from "./$types";
import { getRequestUser } from "../../../../../utilities";

export const GET: RequestHandler = async ({ params }) => {
	try {
		await requireClientAccess(await getRequestUser(), params.clientId, "view");
		const file = await getClientContextFile(params.clientId, params.fileId);
		if (!file) return new Response("Fichier introuvable.", { status: 404 });

		const downloadName = file.mimeType === "application/pdf" ? `${file.name}.txt` : file.name;
		return new Response(file.content, {
			headers: {
				"Content-Type": `${file.mimeType === "text/markdown" ? "text/markdown" : "text/plain"}; charset=utf-8`,
				"Content-Length": String(Buffer.byteLength(file.content, "utf8")),
				"Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
				"X-Content-Type-Options": "nosniff",
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Une erreur est survenue.";
		return new Response(message, { status: message === "Unauthorized" ? 403 : 400 });
	}
};
