import { env } from "$env/dynamic/private";
import { type ClickHouseClient, createClient as createClickhouseClient } from "@clickhouse/client";

const clickhouseClients: Record<string, ClickHouseClient> = {};

export function getClickhouseDatabase(): string {
	return "default";
}

export function getClickhouseClient({ database = getClickhouseDatabase() } = {}): ClickHouseClient {
	return (clickhouseClients[database] ??= createClickhouseClient({
		url: env.CLICKHOUSE_URL,
		username: env.CLICKHOUSE_USERNAME,
		password: env.CLICKHOUSE_PASSWORD,
		database,
		request_timeout: 10_000,
		max_open_connections: 3,
		clickhouse_settings: {
			async_insert: 1,
			async_insert_busy_timeout_ms: 1000,
			// Do not acknowledge an insert until ClickHouse has flushed it. Without this,
			// callbacks can return successfully while their rows are still only queued in
			// memory, and a server restart can silently lose them.
			wait_for_async_insert: 1,
		},
	}));
}
