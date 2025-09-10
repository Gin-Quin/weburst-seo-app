import {
	getClickhouseClient,
	getClickhouseDatabase,
} from "../src/lib/server/clickhouse";
import { clickhouseMigrations } from "../src/lib/server/clickhouse/migrations";

if (import.meta.main) {
	migrateClickhouse();
}

async function migrateClickhouse() {
	const database = getClickhouseDatabase();
	console.log(`⛵ Applying Clickhouse migrations for database ${database}`);

	const clickhouse = getClickhouseClient({ database: "default" });

	if (clickhouse instanceof Error) {
		console.error(clickhouse);
		process.exit(1);
	}

	// create database if not exists
	await clickhouse.command({
		query: `CREATE DATABASE IF NOT EXISTS ${database}`,
	});

	// create migrations table if not exists
	await clickhouse.command({
		query: `CREATE TABLE IF NOT EXISTS ${database}.migrations (name String, appliedAt DateTime) ENGINE = MergeTree PRIMARY KEY name`,
	});

	// then apply migrations that have not been applied yet
	const appliedMigrations = await (
		await clickhouse.query({
			query: `SELECT name FROM ${database}.migrations`,
		})
	).json<{ name: string }>();

	for (const migration of clickhouseMigrations) {
		if (appliedMigrations.data.some(({ name }) => name === migration.name)) {
			console.log(`⋅ Migration ${migration.name} already applied`);
			continue;
		}

		try {
			await clickhouse.command({ query: migration.query(database) });
			await clickhouse.insert({
				table: `${database}.migrations`,
				values: [{ name: migration.name, appliedAt: Date.now() }],
				format: "JSONEachRow",
			});
			console.log(`✔︎ Applied migration ${migration.name}`);
		} catch (error) {
			console.error(`❌ Error applying migration ${migration.name}: ${error}`);
		}
	}

	console.log(`👌 Everything is up to date`);
}
