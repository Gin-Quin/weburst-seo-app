import { expect, test } from "bun:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../db/schema";
import { getProjectTypology } from "./typologies";
import { parse } from "valibot";
import { SaveTypology } from "../../../routes/api/contents/typologies.schema";

test("typologies are shared across a client's projects and isolated from other clients", async () => {
	const client = createClient({ url: "file::memory:" });
	try {
		await client.executeMultiple(`
			PRAGMA foreign_keys = ON;
			CREATE TABLE clients (id text PRIMARY KEY);
			CREATE TABLE projects (id text PRIMARY KEY, client_id text);
			CREATE TABLE contents (id text PRIMARY KEY);
			INSERT INTO clients VALUES ('a'), ('b');
			INSERT INTO projects VALUES ('a1', 'a'), ('a2', 'a'), ('b1', 'b');
			INSERT INTO contents VALUES ('existing');
		`);
		const migration = await Bun.file(new URL("../../../../drizzle/0014_elite_falcon.sql", import.meta.url)).text();
		for (const statement of migration.split("--> statement-breakpoint").filter((s) => s.trim())) await client.execute(statement);
		await client.execute("INSERT INTO content_typologies VALUES ('guide', 'a', 'Guide', 'Ton pédagogique')");
		const db = drizzle(client, { schema });
		for (const project of ["a1", "a2"]) expect((await getProjectTypology(db, project, "guide"))?.instructions).toBe("Ton pédagogique");
		await expect(getProjectTypology(db, "b1", "guide")).rejects.toThrow("client");
		expect(await getProjectTypology(db, "a1", null)).toBeNull();
		await client.execute("UPDATE contents SET typology_id = 'guide' WHERE id = 'existing'");
		await client.execute("DELETE FROM content_typologies WHERE id = 'guide'");
		expect((await client.execute("SELECT typology_id FROM contents")).rows[0]?.typology_id).toBeNull();
	} finally { client.close(); }
});

test("typology validation requires a name and reusable instructions", () => {
	expect(() => parse(SaveTypology, { projectId: "a", name: " ", instructions: "tone" })).toThrow();
	expect(() => parse(SaveTypology, { projectId: "a", name: "Guide", instructions: " " })).toThrow();
	expect(parse(SaveTypology, { projectId: "a", name: " Guide ", instructions: " Tone " }).name).toBe("Guide");
});
