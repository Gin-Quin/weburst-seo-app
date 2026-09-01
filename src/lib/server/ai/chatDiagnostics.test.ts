import { describe, expect, test } from "bun:test";
import { describeChatError, summarizeChatMessages } from "./chatDiagnostics";

describe("content chat diagnostics", () => {
	test("summarizes messages without logging their text or tool payloads", () => {
		const summary = summarizeChatMessages([
			{
				id: "message-1",
				role: "user",
				parts: [
					{ type: "text", text: "secret prompt" },
					{ type: "tool-write_article", state: "input-streaming", input: { content: "secret" } },
				],
			},
		]);

		expect(summary).toEqual([
			{
				index: 0,
				role: "user",
				id: "message-1",
				parts: [
					{ type: "text", state: undefined, textLength: 13, hasError: false },
					{
						type: "tool-write_article",
						state: "input-streaming",
						textLength: undefined,
						hasError: false,
					},
				],
			},
		]);
		expect(JSON.stringify(summary)).not.toContain("secret");
	});

	test("captures safe provider error fields and a bounded cause", () => {
		const cause = Object.assign(new Error("provider rejected the request"), {
			code: "PROVIDER_ERROR",
			statusCode: 400,
		});
		const error = Object.assign(new Error("generation failed"), {
			isRetryable: false,
			cause,
			url: "https://example.test?key=must-not-be-logged",
		});

		const diagnostic = describeChatError(error);

		expect(diagnostic.message).toBe("generation failed");
		expect(diagnostic.isRetryable).toBe(false);
		expect(diagnostic.cause).toMatchObject({
			message: "provider rejected the request",
			code: "PROVIDER_ERROR",
			statusCode: 400,
		});
		expect(JSON.stringify(diagnostic)).not.toContain("must-not-be-logged");
	});
});
