import { expect, test } from "bun:test";
import { createClient } from "@libsql/client";

test("adds independent chat memories to clients and contents", async () => {
	const db = createClient({ url: "file::memory:" });

	try {
		await db.execute("CREATE TABLE clients (id text PRIMARY KEY NOT NULL)");
		await db.execute("CREATE TABLE contents (id text PRIMARY KEY NOT NULL)");
		const migration = await Bun.file(new URL("./0013_fixed_shriek.sql", import.meta.url)).text();
		for (const statement of migration
			.split("--> statement-breakpoint")
			.map((value) => value.trim())
			.filter(Boolean)) {
			await db.execute(statement);
		}

		const clientColumns = await db.execute("PRAGMA table_info(clients)");
		const contentColumns = await db.execute("PRAGMA table_info(contents)");
		for (const columns of [clientColumns, contentColumns]) {
			const memoryColumn = columns.rows.find((column) => column.name === "chat_memory");
			expect(memoryColumn?.notnull).toBe(1);
			expect(memoryColumn?.dflt_value).toBe("''");
		}
	} finally {
		db.close();
	}
});
