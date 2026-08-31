import { describe, expect, test } from "bun:test";
import { getFailedUserMessageId } from "./chatRetry";

describe("getFailedUserMessageId", () => {
	test("returns the latest user message after a failed response", () => {
		expect(
			getFailedUserMessageId(
				[
					{ id: "user-1", role: "user" },
					{ id: "assistant-1", role: "assistant" },
					{ id: "user-2", role: "user" },
					{ id: "assistant-partial", role: "assistant" },
				],
				"error",
			),
		).toBe("user-2");
	});

	test("does not replace a message when the chat is ready", () => {
		expect(getFailedUserMessageId([{ id: "user-1", role: "user" }], "ready")).toBeUndefined();
	});

	test("returns undefined when no user message can be retried", () => {
		expect(
			getFailedUserMessageId([{ id: "assistant-1", role: "assistant" }], "error"),
		).toBeUndefined();
	});
});
