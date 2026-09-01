import type { UIMessageChunk } from "ai";

type ProtectedToolInput = {
	toolName: string;
	isValid: (input: unknown) => boolean;
	errorText: string;
};

/**
 * Keeps a selected tool's incremental JSON input server-side until the AI SDK
 * has assembled and validated the complete input. Invalid or interrupted input
 * is never exposed as a partial tool call to the browser.
 */
export function protectToolInputStream<METADATA = unknown>(
	stream: ReadableStream<UIMessageChunk<METADATA>>,
	protectedTool: ProtectedToolInput,
): ReadableStream<UIMessageChunk<METADATA>> {
	const pendingToolCallIds = new Set<string>();

	return stream.pipeThrough(
		new TransformStream<UIMessageChunk<METADATA>, UIMessageChunk<METADATA>>({
			transform(chunk, controller) {
				if (chunk.type === "tool-input-start" && chunk.toolName === protectedTool.toolName) {
					pendingToolCallIds.add(chunk.toolCallId);
					return;
				}

				if (
					chunk.type === "tool-input-delta" &&
					pendingToolCallIds.has(chunk.toolCallId)
				) {
					return;
				}

				if (chunk.type === "tool-input-available" && chunk.toolName === protectedTool.toolName) {
					pendingToolCallIds.delete(chunk.toolCallId);
					if (protectedTool.isValid(chunk.input)) {
						controller.enqueue(chunk);
					} else {
						controller.enqueue({ type: "error", errorText: protectedTool.errorText });
					}
					return;
				}

				if (chunk.type === "tool-input-error" && chunk.toolName === protectedTool.toolName) {
					pendingToolCallIds.delete(chunk.toolCallId);
					controller.enqueue({ type: "error", errorText: protectedTool.errorText });
					return;
				}

				if (chunk.type === "abort" || chunk.type === "finish") {
					pendingToolCallIds.clear();
				}

				controller.enqueue(chunk);
			},
		}),
	);
}
