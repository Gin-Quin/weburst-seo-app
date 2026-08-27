import { describe, expect, test } from "bun:test";
import {
	decodeContextTextFile,
	getContextFileExtension,
	MAX_CLIENT_CONTEXT_FILE_SIZE,
	MAX_CLIENT_CONTEXT_TOTAL_UPLOAD_SIZE,
	validateContextFile,
	validateContextFileContents,
	validateContextUpload,
} from "./validation";

describe("client context file validation", () => {
	test("accepts the supported extensions and MIME types", () => {
		expect(getContextFileExtension("brief.TXT")).toBe("txt");
		expect(validateContextFile({ name: "brief.md", type: "text/markdown", size: 12 })).toBe("md");
		expect(validateContextFile({ name: "brief.pdf", type: "application/pdf", size: 12 })).toBe(
			"pdf",
		);
	});

	test("checks PDF signatures and UTF-8 text contents", () => {
		expect(() =>
			validateContextFileContents("pdf", new TextEncoder().encode("not a pdf")),
		).toThrow();
		expect(() =>
			validateContextFileContents("pdf", new TextEncoder().encode("%PDF-1.7\n")),
		).not.toThrow();
		expect(() => validateContextFileContents("txt", new Uint8Array([0xff]))).toThrow();
		expect(() =>
			validateContextFileContents("md", new TextEncoder().encode("# Contexte")),
		).not.toThrow();
		expect(decodeContextTextFile(new TextEncoder().encode("\uFEFFContexte"))).toBe("Contexte");
	});

	test("rejects unsupported extensions, mismatched types and oversized files", () => {
		expect(() =>
			validateContextFile({ name: "brief.docx", type: "application/pdf", size: 12 }),
		).toThrow();
		expect(() =>
			validateContextFile({ name: "brief.pdf", type: "text/plain", size: 12 }),
		).toThrow();
		expect(() =>
			validateContextFile({
				name: "brief.txt",
				type: "text/plain",
				size: MAX_CLIENT_CONTEXT_FILE_SIZE + 1,
			}),
		).toThrow();
	});

	test("limits the total size of a batch", () => {
		expect(() =>
			validateContextUpload([
				{ name: "one.pdf", type: "application/pdf", size: MAX_CLIENT_CONTEXT_FILE_SIZE },
				{ name: "two.pdf", type: "application/pdf", size: MAX_CLIENT_CONTEXT_FILE_SIZE },
				{
					name: "three.pdf",
					type: "application/pdf",
					size: MAX_CLIENT_CONTEXT_TOTAL_UPLOAD_SIZE - MAX_CLIENT_CONTEXT_FILE_SIZE * 2 + 1,
				},
			]),
		).toThrow();
	});
});
