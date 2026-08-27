import { getGoogleGenerativeAI, GOOGLE_CHAT_MODEL } from "$lib/server/ai/google";
import { generateText } from "ai";
import type { ClientContextExtension } from "./validation";
import { decodeContextTextFile, validateContextFileContents } from "./validation";

export class PdfTextExtractionError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "PdfTextExtractionError";
	}
}

export async function extractClientContextFileText(input: {
	name: string;
	extension: ClientContextExtension;
	data: Uint8Array;
}): Promise<string> {
	if (input.extension !== "pdf") return decodeContextTextFile(input.data);

	validateContextFileContents("pdf", input.data);
	const google = getGoogleGenerativeAI();
	if (!google) {
		throw new PdfTextExtractionError(
			"L’extraction PDF nécessite une clé GEMINI_API_KEY configurée.",
			503,
		);
	}

	try {
		const result = await generateText({
			model: google(GOOGLE_CHAT_MODEL),
			messages: [
				{
					role: "user",
					content: [
						{
							type: "file",
							data: input.data,
							mediaType: "application/pdf",
							filename: input.name,
						},
						{
							type: "text",
							text: "Extrais tout le texte de ce PDF, y compris le texte lisible dans les pages scannées. Restitue uniquement le contenu textuel, sans résumé, commentaire, préambule ni bloc de code. Préserve autant que possible les titres, paragraphes, listes et tableaux dans un format texte lisible.",
						},
					],
				},
			],
			temperature: 0,
		});
		const text = result.text.trim();
		if (result.finishReason === "length") {
			throw new Error("truncated extraction");
		}
		if (!text) throw new Error("empty extraction");
		return text;
	} catch (error) {
		console.error("Gemini PDF text extraction error", error);
		throw new PdfTextExtractionError(
			`Le texte du fichier « ${input.name} » n’a pas pu être extrait.`,
			502,
		);
	}
}
