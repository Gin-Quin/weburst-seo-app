import {
	type ClickHouseClient,
	createClient as createClickhouseClient,
} from "@clickhouse/client";
import { execSync } from "node:child_process";

let clickhouse: ClickHouseClient;

export function getClickhouseDatabase(): string {
	const database =
		process.env.CLICKHOUSE_DATABASE ||
		execSync("git branch --show-current").toString().trim();

	return database == "main" ? "default" : database;
}

export function getClickhouseClient({
	database = getClickhouseDatabase(),
} = {}): ClickHouseClient | Error {
	try {
		clickhouse ??= createClickhouseClient({
			url: process.env.CLICKHOUSE_URL,
			username: process.env.CLICKHOUSE_USERNAME,
			password: process.env.CLICKHOUSE_PASSWORD,
			database,
			request_timeout: 10_000,
			max_open_connections: 3,
			clickhouse_settings: {
				async_insert: 1,
				async_insert_busy_timeout_ms: 1000,
			},
		});
		return clickhouse;
	} catch (error) {
		return error instanceof Error
			? error
			: new Error("Failed to create Clickhouse client");
	}
}
