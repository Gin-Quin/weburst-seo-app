import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { MAX_CHAT_MEMORY_LENGTH } from "$lib/contents/chatMemory";
import * as schema from "../db/schema";
import {
	appendClientChatMemory,
	appendContentChatMemory,
	appendMemory,
	loadClientChatContext,
	loadClientChatMemory,
} from "./chatMemory";

describe("chat memory persistence", () => {
	let client: Client;
	let database: ReturnType<typeof drizzle<typeof schema>>;

	beforeEach(async () => {
		client = createClient({ url: ":memory:" });
		database = drizzle(client, { schema });
		await client.executeMultiple(`
			CREATE TABLE clients (
				id TEXT PRIMARY KEY NOT NULL,
				context TEXT NOT NULL DEFAULT '',
				chat_memory TEXT NOT NULL DEFAULT '',
				updated_at INTEGER NOT NULL
			);
			CREATE TABLE contents (
				id TEXT PRIMARY KEY NOT NULL,
				project_id TEXT NOT NULL,
				chat_memory TEXT NOT NULL DEFAULT '',
				updated_at INTEGER NOT NULL
			);
			INSERT INTO clients (id, updated_at) VALUES ('client-1', 0), ('client-2', 0);
			INSERT INTO contents (id, project_id, updated_at)
			VALUES ('content-1', 'project-1', 0), ('content-2', 'project-1', 0);
		`);
	});

	afterEach(() => client.close());

	test("keeps content memory separate from shared client memory", async () => {
		const contentMemory = await appendContentChatMemory(database, {
			contentId: "content-1",
			projectId: "project-1",
			information: "Cet article s’adresse aux dirigeants de PME.",
		});
		const clientMemory = await appendClientChatMemory(database, {
			clientId: "client-1",
			information: "Le client emploie toujours un ton formel.",
		});

		expect(contentMemory).toBe("- Cet article s’adresse aux dirigeants de PME.");
		expect(clientMemory).toBe("- Le client emploie toujours un ton formel.");
		expect(await loadClientChatMemory(database, "client-1")).toBe(clientMemory);
		expect(await loadClientChatMemory(database, "client-2")).toBe("");
	});

	test("loads the client information with its shared memory", async () => {
		await client.execute({
			sql: "UPDATE clients SET context = ?, chat_memory = ? WHERE id = ?",
			args: ["Le client vend des vélos cargo.", "- Employer un ton accessible.", "client-1"],
		});

		expect(await loadClientChatContext(database, "client-1")).toEqual({
			context: "Le client vend des vélos cargo.",
			memory: "- Employer un ton accessible.",
		});
		expect(await loadClientChatContext(database, null)).toEqual({ context: "", memory: "" });
	});

	test("does not save the same information twice", async () => {
		await appendClientChatMemory(database, {
			clientId: "client-1",
			information: "Le ton de marque est direct.",
		});
		const memory = await appendClientChatMemory(database, {
			clientId: "client-1",
			information: "  - le ton de marque est direct.  ",
		});

		expect(memory).toBe("- Le ton de marque est direct.");
	});

	test("scopes content updates to the requested project", async () => {
		expect(
			appendContentChatMemory(database, {
				contentId: "content-1",
				projectId: "project-2",
				information: "Ne doit pas être enregistré.",
			}),
		).rejects.toThrow("Contenu introuvable");
	});
});

describe("chat memory formatting", () => {
	test("stores compact standalone bullet points", () => {
		expect(appendMemory("", "  * Le client\n préfère   le vouvoiement. ")).toBe(
			"- Le client préfère le vouvoiement.",
		);
	});

	test("rejects a memory that exceeds the total limit", () => {
		expect(() => appendMemory(`- ${"a".repeat(MAX_CHAT_MEMORY_LENGTH - 2)}`, "nouveau")).toThrow(
			"La mémoire ne peut pas dépasser",
		);
	});
});
