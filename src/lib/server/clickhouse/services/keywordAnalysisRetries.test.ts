import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test.skipIf(!process.env.TEST_CLICKHOUSE_URL)(
	"retries and partial metrics against ClickHouse",
	async () => {
		const subprocess = Bun.spawn(
			[
				process.execPath,
				fileURLToPath(new URL("./fixtures/keywordAnalysisRetries.ts", import.meta.url)),
			],
			{ stdout: "pipe", stderr: "pipe" },
		);
		const [exitCode, stdout, stderr] = await Promise.all([
			subprocess.exited,
			new Response(subprocess.stdout).text(),
			new Response(subprocess.stderr).text(),
		]);
		expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
		expect(stdout).toContain("duplicate callback checks passed");
	},
	60_000,
);
