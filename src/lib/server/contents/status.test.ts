import { expect, test } from "bun:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { contents } from "../db/schema";
import { statusAfterContentEdit } from "./status";
import { safeParse } from "valibot";
import { SetStatus } from "../../../routes/api/contents/contents.schema";

test("saving a draft only advances new articles and preserves chosen statuses", async () => {
	const client = createClient({ url: "file::memory:" });
	try {
		await client.executeMultiple("CREATE TABLE contents (status text); INSERT INTO contents VALUES ('new'), ('in_progress'), ('done'), ('published');");
		await drizzle(client).update(contents).set({ status: statusAfterContentEdit });
		expect((await client.execute("SELECT status FROM contents")).rows.map((row) => row.status)).toEqual(["in_progress", "in_progress", "done", "published"]);
	} finally { client.close(); }
});

test("all editorial statuses including published are accepted, unknown values rejected", () => {
	for (const status of ["new", "in_progress", "done", "published"]) {
		expect(safeParse(SetStatus, { projectId: "p", id: "c", status }).success).toBe(true);
	}
	expect(safeParse(SetStatus, { projectId: "p", id: "c", status: "invalid" }).success).toBe(false);
});
