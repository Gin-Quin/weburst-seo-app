import { expect, test } from "bun:test";
import type { UIMessageChunk } from "ai";
import { protectToolInputStream } from "./protectToolInputStream";

const protection = {
	toolName: "write_article",
	isValid: (input: unknown) =>
		Boolean(
			input &&
				typeof input === "object" &&
				typeof (input as { content?: unknown }).content === "string" &&
				typeof (input as { summary?: unknown }).summary === "string",
		),
	errorText: "Invalid article proposal.",
};

test("streams text while buffering write_article input until it is complete", async () => {
	const output = await collect([
		{ type: "text-start", id: "text-1" },
		{ type: "text-delta", id: "text-1", delta: "Bonjour" },
		{ type: "tool-input-start", toolCallId: "tool-1", toolName: "write_article" },
		{ type: "tool-input-delta", toolCallId: "tool-1", inputTextDelta: '{"content":' },
		{
			type: "tool-input-available",
			toolCallId: "tool-1",
			toolName: "write_article",
			input: { content: "Article", summary: "Résumé" },
		},
	]);

	expect(output).toEqual([
		{ type: "text-start", id: "text-1" },
		{ type: "text-delta", id: "text-1", delta: "Bonjour" },
		{
			type: "tool-input-available",
			toolCallId: "tool-1",
			toolName: "write_article",
			input: { content: "Article", summary: "Résumé" },
		},
	]);
});

test("does not expose interrupted write_article input", async () => {
	const output = await collect([
		{ type: "tool-input-start", toolCallId: "tool-1", toolName: "write_article" },
		{ type: "tool-input-delta", toolCallId: "tool-1", inputTextDelta: '{"content":' },
		{ type: "abort", reason: "connection lost" },
	]);

	expect(output).toEqual([{ type: "abort", reason: "connection lost" }]);
});

test("replaces invalid write_article input with a payload-free error", async () => {
	const output = await collect([
		{ type: "tool-input-start", toolCallId: "tool-1", toolName: "write_article" },
		{
			type: "tool-input-available",
			toolCallId: "tool-1",
			toolName: "write_article",
			input: { content: "missing summary" },
		},
	]);

	expect(output).toEqual([{ type: "error", errorText: "Invalid article proposal." }]);
});

async function collect(chunks: UIMessageChunk[]): Promise<UIMessageChunk[]> {
	const stream = new ReadableStream<UIMessageChunk>({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(chunk);
			controller.close();
		},
	});
	const reader = protectToolInputStream(stream, protection).getReader();
	const output: UIMessageChunk[] = [];
	while (true) {
		const { done, value } = await reader.read();
		if (done) return output;
		output.push(value);
	}
}
