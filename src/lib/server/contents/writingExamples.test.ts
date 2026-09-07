import { expect, test } from "bun:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../db/schema";
import { getClientWritingExamples, formatWritingExamples } from "./writingExamples";

test("uses published client examples, prefers the typology, and observes status changes", async () => {
	const client = createClient({ url: "file::memory:" });
	try {
		await client.executeMultiple(`
			CREATE TABLE projects (id text PRIMARY KEY, client_id text, deleted_at integer);
			CREATE TABLE contents (id text PRIMARY KEY, project_id text, title text, content_text text, typology_id text, status text, archived_at integer, updated_at integer);
			INSERT INTO projects VALUES ('p1', 'a', NULL), ('p2', 'a', NULL), ('other', 'b', NULL), ('deleted', 'a', 1), ('legacy', NULL, NULL);
			INSERT INTO contents VALUES
			('current', 'p1', 'Current', 'text', 'guide', 'published', NULL, 100),
			('match', 'p2', 'Guide', 'style', 'guide', 'published', NULL, 1),
			('recent', 'p1', 'Recent', 'style', NULL, 'published', NULL, 30),
			('older', 'p1', 'Older', 'style', NULL, 'published', NULL, 20),
			('oldest', 'p1', 'Oldest', 'style', NULL, 'published', NULL, 10),
			('private', 'other', 'Private', 'secret', 'guide', 'published', NULL, 500),
			('draft', 'p1', 'Draft', 'text', 'guide', 'done', NULL, 500),
			('archived', 'p1', 'Archived', 'text', 'guide', 'published', 1, 500),
			('empty', 'p1', 'Empty', '   ', 'guide', 'published', NULL, 500),
			('deleted', 'deleted', 'Deleted', 'text', 'guide', 'published', NULL, 500);
		`);
		const db = drizzle(client, { schema });
		const input = { projectId: "p1", contentId: "current", typologyId: "guide" };
		expect((await getClientWritingExamples(db, input)).map((row) => row.id)).toEqual(["match", "recent", "older"]);
		await client.execute("UPDATE contents SET status = 'in_progress' WHERE id = 'match'");
		expect((await getClientWritingExamples(db, input)).map((row) => row.id)).toEqual(["recent", "older", "oldest"]);
		expect(await getClientWritingExamples(db, { ...input, projectId: "legacy" })).toEqual([]);
		await client.execute({ sql: "UPDATE contents SET content_text = ? WHERE id = 'recent'", args: ["x".repeat(10_000)] });
		expect((await getClientWritingExamples(db, input))[0]?.text.length).toBe(6000);
		expect(formatWritingExamples([])).toContain("Aucun article publié");
	} finally { client.close(); }
});
