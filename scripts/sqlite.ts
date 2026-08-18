import { Database } from "bun:sqlite";

const databaseUrl = process.env.DATABASE_URL;
const sql = process.argv[2];
const parameters = process.argv.slice(3);

if (!databaseUrl) {
	throw new Error("DATABASE_URL is not set");
}

if (!databaseUrl.startsWith("file:")) {
	throw new Error(`Expected a local SQLite URL, received: ${databaseUrl}`);
}

if (!sql) {
	console.error('Usage: bun run sqlite "SELECT * FROM users WHERE email = ?" email@example.com');
	process.exit(1);
}

const databasePath = databaseUrl.slice("file:".length);
const database = new Database(databasePath);

try {
	const rows = database.query(sql).all(...parameters);
	console.log(JSON.stringify(rows, null, 2));
} finally {
	database.close();
}
