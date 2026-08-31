import type { ChatStatus } from "ai";

type ChatMessageIdentity = {
	id: string;
	role: string;
};

export function getFailedUserMessageId(
	messages: ChatMessageIdentity[],
	status: ChatStatus,
): string | undefined {
	if (status !== "error") return undefined;

	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message?.role === "user") return message.id;
	}

	return undefined;
}
