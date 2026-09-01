import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../db/schema";
import { loadContentChatMessages, upsertContentChatMessages } from "./contentChats";

describe("content chat persistence", () => {
	let client: Client;
	let database: ReturnType<typeof drizzle<typeof schema>>;

	beforeEach(async () => {
		client = createClient({ url: ":memory:" });
		database = drizzle(client, { schema });
		await client.executeMultiple(`
			CREATE TABLE content_chats (
				content_id TEXT NOT NULL,
				user_id TEXT NOT NULL,
				messages_json TEXT NOT NULL DEFAULT '[]',
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL,
				PRIMARY KEY (content_id, user_id)
			);
		`);
	});

	afterEach(() => client.close());

	test("keeps histories for two users on the same content separate", async () => {
		const aliceMessages = [{ id: "alice-message", role: "user", parts: [{ type: "text", text: "A" }] }];
		const bobMessages = [{ id: "bob-message", role: "user", parts: [{ type: "text", text: "B" }] }];

		await upsertContentChatMessages(database, "content-1", "alice", aliceMessages);
		await upsertContentChatMessages(database, "content-1", "bob", bobMessages);

		expect(await loadContentChatMessages(database, "content-1", "alice")).toEqual(aliceMessages);
		expect(await loadContentChatMessages(database, "content-1", "bob")).toEqual(bobMessages);
	});

	test("clearing one user's history does not clear another user's history", async () => {
		const bobMessages = [{ id: "bob-message", role: "assistant", parts: [] }];
		await upsertContentChatMessages(database, "content-1", "alice", [{ id: "alice-message" }]);
		await upsertContentChatMessages(database, "content-1", "bob", bobMessages);

		await upsertContentChatMessages(database, "content-1", "alice", []);

		expect(await loadContentChatMessages(database, "content-1", "alice")).toEqual([]);
		expect(await loadContentChatMessages(database, "content-1", "bob")).toEqual(bobMessages);
	});

	test("returns an empty history for a user without a chat", async () => {
		await upsertContentChatMessages(database, "content-1", "alice", [{ id: "alice-message" }]);

		expect(await loadContentChatMessages(database, "content-1", "bob")).toEqual([]);
	});
});
