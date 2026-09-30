import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("fails when all keywords fail after retry exhaustion and ignores late callbacks without exposing provider diagnostics", async () => {
	const subprocess = Bun.spawn(
		[
			process.execPath,
			fileURLToPath(new URL("./fixtures/keywordAnalysisFailure.ts", import.meta.url)),
		],
		{
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const [exitCode, stdout, stderr] = await Promise.all([
		subprocess.exited,
		new Response(subprocess.stdout).text(),
		new Response(subprocess.stderr).text(),
	]);
	expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
	expect(stdout).toContain("diagnostic checks passed");
});
