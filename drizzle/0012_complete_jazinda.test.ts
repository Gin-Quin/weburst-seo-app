import { expect, test } from "bun:test";
import { createClient } from "@libsql/client";

test("migrates prospects and removes audit analysis frequencies", async () => {
	const db = createClient({ url: "file::memory:" });

	try {
		await db.execute(`
			CREATE TABLE projects (
				id text PRIMARY KEY NOT NULL,
				type text NOT NULL,
				keyword_analysis_frequency text NOT NULL
			)
		`);
		await db.batch(
			[
				["prospect", "prospect", "1/week"],
				["audit", "audit", "1/month"],
				["subscription", "monthly_subscription", "1/day"],
			].map(([id, type, frequency]) => ({
				sql: "INSERT INTO projects VALUES (?, ?, ?)",
				args: [id!, type!, frequency!],
			})),
			"write",
		);

		const migration = await Bun.file(new URL("./0012_complete_jazinda.sql", import.meta.url)).text();
		for (const statement of migration
			.split("--> statement-breakpoint")
			.map((value) => value.trim())
			.filter(Boolean)) {
			await db.execute(statement);
		}

		const projects = await db.execute(
			"SELECT id, type, keyword_analysis_frequency FROM projects ORDER BY id",
		);
		expect(projects.rows).toEqual([
			{ id: "audit", type: "audit", keyword_analysis_frequency: null },
			{ id: "prospect", type: "audit", keyword_analysis_frequency: null },
			{
				id: "subscription",
				type: "monthly_subscription",
				keyword_analysis_frequency: "1/day",
			},
		]);

		const columns = await db.execute("PRAGMA table_info(projects)");
		const frequencyColumn = columns.rows.find(
			(column) => column.name === "keyword_analysis_frequency",
		);
		expect(frequencyColumn?.notnull).toBe(0);
	} finally {
		db.close();
	}
});
