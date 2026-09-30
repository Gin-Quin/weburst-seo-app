import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("postback callback acknowledges only what it has stored", async () => {
	const subprocess = Bun.spawn(
		[process.execPath, fileURLToPath(new URL("./fixtures/keywordCallbackRoute.ts", import.meta.url))],
		{ stdout: "pipe", stderr: "pipe" },
	);
	const [exitCode, stdout, stderr] = await Promise.all([
		subprocess.exited,
		new Response(subprocess.stdout).text(),
		new Response(subprocess.stderr).text(),
	]);
	expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
	expect(stdout).toContain("rejection and failure checks passed");
}, 30_000);
