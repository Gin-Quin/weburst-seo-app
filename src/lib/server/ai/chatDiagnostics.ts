type DiagnosticRecord = Record<string, unknown>;

export type ContentChatLogLevel = "info" | "warn" | "error";

export function summarizeChatMessages(messages: unknown[]): DiagnosticRecord[] {
	return messages.map((message, index) => {
		if (!isRecord(message)) return { index, type: typeof message };

		const parts = Array.isArray(message.parts) ? message.parts : [];
		return {
			index,
			role: typeof message.role === "string" ? message.role : "unknown",
			id: typeof message.id === "string" ? message.id : undefined,
			parts: parts.map((part) => summarizeMessagePart(part)),
		};
	});
}

export function describeChatError(error: unknown, depth = 0): DiagnosticRecord {
	if (!isRecord(error)) {
		return {
			type: error === null ? "null" : typeof error,
			value: typeof error === "string" ? truncate(error) : String(error),
		};
	}

	const diagnostic: DiagnosticRecord = {
		name: stringProperty(error, "name") ?? error.constructor?.name ?? "Error",
		message: truncate(stringProperty(error, "message") ?? String(error)),
		stack: truncate(stringProperty(error, "stack"), 4_000),
		code: primitiveProperty(error, "code"),
		statusCode: primitiveProperty(error, "statusCode"),
		isRetryable: primitiveProperty(error, "isRetryable"),
	};

	if (depth < 1 && "cause" in error && error.cause !== undefined) {
		diagnostic.cause = describeChatError(error.cause, depth + 1);
	}

	return diagnostic;
}

export function logContentChatEvent(
	level: ContentChatLogLevel,
	event: string,
	context: DiagnosticRecord,
) {
	const line = JSON.stringify({ scope: "content-chat", event, ...context });
	console[level](`[content-chat] ${line}`);
}

function summarizeMessagePart(part: unknown): DiagnosticRecord {
	if (!isRecord(part)) return { type: typeof part };

	return {
		type: typeof part.type === "string" ? part.type : "unknown",
		state: typeof part.state === "string" ? part.state : undefined,
		textLength: typeof part.text === "string" ? part.text.length : undefined,
		hasError: typeof part.errorText === "string" || part.error !== undefined,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function stringProperty(record: Record<string, unknown>, key: string): string | undefined {
	return typeof record[key] === "string" ? record[key] : undefined;
}

function primitiveProperty(record: Record<string, unknown>, key: string) {
	const value = record[key];
	return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
		? value
		: undefined;
}

function truncate(value: string | undefined, maxLength = 1_000): string | undefined {
	if (value === undefined || value.length <= maxLength) return value;
	return `${value.slice(0, maxLength)}…`;
}
