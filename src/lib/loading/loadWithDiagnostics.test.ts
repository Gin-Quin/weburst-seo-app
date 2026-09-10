import { expect, test } from "bun:test";
import { loadWithDiagnostics, type LoadFailure } from "./loadWithDiagnostics";

test("starts the query synchronously to preserve Svelte effect tracking", async () => {
	let started = false;
	const result = loadWithDiagnostics(
		"listProjects",
		() => {
			started = true;
			return Promise.resolve([]);
		},
		() => {},
	);
	expect(started).toBe(true);
	await result;
});

test("returns the loaded data without reporting an error", async () => {
	const failures: LoadFailure[] = [];
	expect(
		await loadWithDiagnostics(
			"listProjects",
			async () => ["project"],
			(failure) => failures.push(failure),
		),
	).toEqual(["project"]);
	expect(failures).toEqual([]);
});

test("logs operation, duration and original network error, then rejects", async () => {
	const failures: LoadFailure[] = [];
	const error = new TypeError("Failed to fetch");
	await expect(
		loadWithDiagnostics(
			"listProjects",
			async () => {
				throw error;
			},
			(failure) => failures.push(failure),
		),
	).rejects.toBe(error);
	expect(failures).toHaveLength(1);
	expect(failures[0]?.operation).toBe("listProjects");
	expect(failures[0]?.error).toBe(error);
	expect(failures[0]?.durationMs).toBeGreaterThanOrEqual(0);
});

test("preserves a remote error reference even when HTTP status was successful", async () => {
	const error = { status: 500, body: { message: "Internal Error", errorId: "reference" } };
	const failures: LoadFailure[] = [];
	await expect(
		loadWithDiagnostics(
			"getKeywordClusters",
			() => Promise.reject(error),
			(failure) => failures.push(failure),
		),
	).rejects.toBe(error);
	expect(failures[0]?.error).toBe(error);
});

test("reports synchronous exceptions as well as promise rejections", async () => {
	const failures: LoadFailure[] = [];
	const error = new Error("Unable to start query");
	await expect(
		loadWithDiagnostics(
			"getCurrentUser",
			() => {
				throw error;
			},
			(failure) => failures.push(failure),
		),
	).rejects.toBe(error);
	expect(failures[0]?.error).toBe(error);
});

test("bounds a stalled load and ignores its late success", async () => {
	const failures: LoadFailure[] = [];
	let resolve!: (value: string) => void;
	const stalled = new Promise<string>((done) => {
		resolve = done;
	});
	await expect(
		loadWithDiagnostics(
			"listProjects",
			() => stalled,
			(failure) => failures.push(failure),
			5,
		),
	).rejects.toMatchObject({ name: "TimeoutError" });
	resolve("late result");
	await stalled;
	expect(failures).toHaveLength(1);
});

test("a late rejection after timeout does not produce another report", async () => {
	const failures: LoadFailure[] = [];
	let reject!: (error: Error) => void;
	const stalled = new Promise<never>((_, fail) => {
		reject = fail;
	});
	await expect(
		loadWithDiagnostics(
			"listClients",
			() => stalled,
			(failure) => failures.push(failure),
			5,
		),
	).rejects.toMatchObject({ name: "TimeoutError" });
	reject(new TypeError("Network disconnected"));
	await Promise.resolve();
	expect(failures).toHaveLength(1);
});

test("does not report intentional aborts or authentication redirects", async () => {
	const failures: LoadFailure[] = [];
	for (const error of [
		new DOMException("Navigation cancelled", "AbortError"),
		{ status: 307, location: "/login" },
	]) {
		await expect(
			loadWithDiagnostics(
				"listProjects",
				() => Promise.reject(error),
				(failure) => failures.push(failure),
			),
		).rejects.toBe(error);
	}
	expect(failures).toEqual([]);
});
