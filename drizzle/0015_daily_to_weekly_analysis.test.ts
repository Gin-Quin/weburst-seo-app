import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";

test("converts daily analyses to weekly without changing other frequencies", async () => {
	const db = new Database(":memory:");
	try {
		db.run("CREATE TABLE projects (id TEXT PRIMARY KEY, keyword_analysis_frequency TEXT)");
		const frequencies = ["1/day", "1/week", "2/month", "1/month", null];
		for (const [index, frequency] of frequencies.entries()) {
			db.run("INSERT INTO projects VALUES (?, ?)", [String(index), frequency]);
		}
		const migration = await Bun.file(new URL("./0015_daily_to_weekly_analysis.sql", import.meta.url)).text();
		db.exec(migration);
		const expected = ["1/week", "1/week", "2/month", "1/month", null].map((frequency) => ({ keyword_analysis_frequency: frequency }));
		const rows = () => db.query("SELECT keyword_analysis_frequency FROM projects ORDER BY id").all();
		expect(rows()).toEqual(expected);
		db.exec(migration);
		expect(rows()).toEqual(expected);
	} finally {
		db.close();
	}
});
