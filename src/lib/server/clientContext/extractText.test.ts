import { describe, expect, test } from "bun:test";
import { extractClientContextFileText } from "./extractText";

describe("client context text extraction without the AI runtime", () => {
	// No SvelteKit environment or Gemini credentials are available in this test.
	test.each(["txt", "md"] as const)("reads %s files without loading Gemini", async (extension) => {
		const content = "# Contexte\nLe client vend des vélos.";
		expect(
			await extractClientContextFileText({
				name: `brief.${extension}`,
				extension,
				data: new TextEncoder().encode(content),
			}),
		).toBe(content);
	});

	test("rejects invalid PDFs before loading Gemini", async () => {
		await expect(
			extractClientContextFileText({
				name: "brief.pdf",
				extension: "pdf",
				data: new TextEncoder().encode("not a PDF"),
			}),
		).rejects.toThrow("Le fichier PDF est invalide.");
	});
});
