import { building, dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export let db: ReturnType<typeof drizzle>;

if (building) {
	db = {} as any;
} else {
	if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
	if (!dev && !env.DATABASE_AUTH_TOKEN) throw new Error("DATABASE_AUTH_TOKEN is not set");

	const client = createClient({
		url: env.DATABASE_URL,
		authToken: env.DATABASE_AUTH_TOKEN,
	});

	db = drizzle(client, { schema });
}
