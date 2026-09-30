import { afterEach, beforeEach, expect, test } from "bun:test";
import { createDataForSeoClient } from "./dataForSeoClient";

const ok = (status_code = 20000) =>
	Response.json({ status_code, status_message: status_code === 20000 ? "Ok" : "Error", tasks: [] });
const originalWarn = console.warn;
beforeEach(() => {
	console.warn = () => {};
});
afterEach(() => {
	console.warn = originalWarn;
});

const client = (fetch: typeof globalThis.fetch, options = {}) =>
	createDataForSeoClient({
		authorization: () => "Basic test",
		fetch,
		retryBaseMs: 1,
		...options,
	});

test("never exceeds the simultaneous call cap", async () => {
	let active = 0;
	let peak = 0;
	const request = client(
		(async () => {
			peak = Math.max(peak, ++active);
			await Bun.sleep(5);
			active--;
			return ok();
		}) as unknown as typeof fetch,
		{ maxInFlight: 3 },
	);
	await Promise.all(Array.from({ length: 20 }, () => request("/x")));
	expect(peak).toBe(3);
});

test("delays calls beyond the per-window budget", async () => {
	const startedAt = Date.now();
	const callTimes: number[] = [];
	const request = client(
		(async () => {
			callTimes.push(Date.now() - startedAt);
			return ok();
		}) as unknown as typeof fetch,
		{ maxCallsPerWindow: 2, windowMs: 100 },
	);
	await Promise.all([request("/x"), request("/x"), request("/x")]);
	expect(callTimes[1]).toBeLessThan(50);
	expect(callTimes[2]).toBeGreaterThanOrEqual(95);
});

test("retries a rate-limited POST, which created no task, until it succeeds", async () => {
	const codes = [40202, 40202, 20000];
	let calls = 0;
	const request = client((async () => ok(codes[calls++])) as unknown as typeof fetch);
	const result = await request<{ status_code: number; status_message: string }>("/x", {
		method: "POST",
		body: [{ keyword: "a" }],
	});
	expect(result.status_code).toBe(20000);
	expect(calls).toBe(3);
});

test("returns the rate-limit body once attempts are exhausted", async () => {
	let calls = 0;
	const request = client(
		(async () => {
			calls++;
			return ok(40202);
		}) as unknown as typeof fetch,
		{ maxAttempts: 3 },
	);
	expect((await request<{ status_code: number; status_message: string }>("/x")).status_code).toBe(40202);
	expect(calls).toBe(3);
});

test("retries HTTP 429 for POST but never an ambiguous 5xx or network failure", async () => {
	let calls = 0;
	const tooMany = client((async () => (calls++ ? ok() : new Response("", { status: 429 }))) as unknown as typeof fetch);
	await tooMany("/x", { method: "POST", body: [] });
	expect(calls).toBe(2);

	calls = 0;
	const serverError = client((async () => (calls++, new Response("boom", { status: 502 }))) as unknown as typeof fetch);
	await expect(serverError("/x", { method: "POST", body: [] })).rejects.toThrow("502");
	expect(calls).toBe(1);

	calls = 0;
	const offline = client((async () => (calls++, Promise.reject(new Error("socket closed")))) as unknown as typeof fetch);
	await expect(offline("/x", { method: "POST", body: [] })).rejects.toThrow("socket closed");
	expect(calls).toBe(1);
});

test("repeats idempotent GETs after a 5xx or network failure", async () => {
	let calls = 0;
	const request = client(
		(async () => {
			calls++;
			if (calls === 1) return new Response("boom", { status: 503 });
			if (calls === 2) throw new Error("socket closed");
			return ok();
		}) as unknown as typeof fetch,
	);
	expect((await request<{ status_code: number; status_message: string }>("/x")).status_code).toBe(20000);
	expect(calls).toBe(3);
});

type Body = { status_code: number; status_message: string };
const asFetch = (fn: (url: any, init: any) => unknown) => fn as unknown as typeof fetch;

test("sends the path, credentials, JSON body and signal to DataForSEO", async () => {
	const calls: Array<{ url: string; init: RequestInit }> = [];
	const signal = new AbortController().signal;
	const request = client(
		asFetch(async (url, init) => {
			calls.push({ url, init });
			return ok();
		}),
	);
	await request("/v3/serp/google/organic/task_post", { method: "POST", body: [{ keyword: "a" }], signal });
	await request("/v3/serp/google/organic/tasks_ready");
	expect(calls[0]!.url).toBe("https://api.dataforseo.com/v3/serp/google/organic/task_post");
	expect(calls[0]!.init).toMatchObject({
		method: "POST",
		headers: { Authorization: "Basic test", "Content-Type": "application/json" },
		body: '[{"keyword":"a"}]',
		signal,
	});
	// GET sends no body and defaults the method.
	expect(calls[1]!.init.method).toBe("GET");
	expect(calls[1]!.init.body).toBeUndefined();
});

test("reads the credentials again on every call", async () => {
	let login = "first";
	const seen: string[] = [];
	const request = createDataForSeoClient({
		authorization: () => login,
		fetch: asFetch(async (_url, init) => {
			seen.push(init.headers.Authorization);
			return ok();
		}),
	});
	await request("/x");
	login = "second";
	await request("/x");
	expect(seen).toEqual(["first", "second"]);
});

test("does not retry other client errors and keeps the provider message", async () => {
	let calls = 0;
	const request = client(asFetch(async () => (calls++, new Response("bad credentials", { status: 401 }))));
	await expect(request("/x")).rejects.toThrow("401");
	await expect(request("/x")).rejects.toThrow("bad credentials");
	expect(calls).toBe(2);
});

test("does not retry a successful response that reports another error code", async () => {
	let calls = 0;
	const request = client(asFetch(async () => (calls++, ok(40200))));
	expect((await request<Body>("/x", { method: "POST", body: [] })).status_code).toBe(40200);
	expect(calls).toBe(1);
});

test("throws once HTTP 429 outlasts every attempt", async () => {
	let calls = 0;
	const request = client(asFetch(async () => (calls++, new Response("", { status: 429 }))), { maxAttempts: 3 });
	await expect(request("/x", { method: "POST", body: [] })).rejects.toThrow("429");
	expect(calls).toBe(3);
});

test("throws the last failure once a GET keeps failing", async () => {
	let calls = 0;
	const request = client(asFetch(async () => Promise.reject(new Error(`offline ${++calls}`))), { maxAttempts: 3 });
	await expect(request("/x")).rejects.toThrow("offline 3");
	expect(calls).toBe(3);
});

test("a failed call releases its slot", async () => {
	const responses = [() => Promise.reject(new Error("boom")), () => Promise.resolve(ok())];
	let calls = 0;
	const request = client(asFetch(() => responses[calls++]!()), { maxInFlight: 1 });
	await expect(request("/x", { method: "POST", body: [] })).rejects.toThrow("boom");
	expect((await request<Body>("/x")).status_code).toBe(20000);
});

test("an unparsable 200 response rejects and releases its slot", async () => {
	let calls = 0;
	const request = client(asFetch(async () => (calls++ ? ok() : new Response("<html>", { status: 200 }))), {
		maxInFlight: 1,
	});
	await expect(request("/x")).rejects.toThrow();
	expect((await request<Body>("/x")).status_code).toBe(20000);
});

test("starts queued calls in order", async () => {
	const order: string[] = [];
	const request = client(
		asFetch(async (url) => {
			order.push(url.split("/").at(-1));
			await Bun.sleep(1);
			return ok();
		}),
		{ maxInFlight: 1 },
	);
	await Promise.all(["a", "b", "c", "d"].map((name) => request(`/${name}`)));
	expect(order).toEqual(["a", "b", "c", "d"]);
});

test("a rate limit holds back every caller, not only the retrying one", async () => {
	const startedAt = Date.now();
	const starts: Record<string, number> = {};
	let limitedOnce = false;
	const request = client(
		asFetch(async (url) => {
			const name = url.split("/").at(-1);
			starts[name] = Date.now() - startedAt;
			if (name === "a" && !limitedOnce) {
				limitedOnce = true;
				return ok(40202);
			}
			return ok();
		}),
		{ retryBaseMs: 80 },
	);
	const first = request("/a", { method: "POST", body: [] });
	await Bun.sleep(10);
	const second = request("/b", { method: "POST", body: [] });
	await Promise.all([first, second]);
	// "b" arrived while "a" was backing off, so it waits for the pause instead of adding load.
	expect(starts.b).toBeGreaterThanOrEqual(75);
});

test("retries count against the per-window budget", async () => {
	const startedAt = Date.now();
	const callTimes: number[] = [];
	const codes = [40202, 20000];
	const request = client(
		asFetch(async () => {
			callTimes.push(Date.now() - startedAt);
			return ok(codes[callTimes.length - 1]);
		}),
		{ maxCallsPerWindow: 1, windowMs: 120, retryBaseMs: 1 },
	);
	await request("/x", { method: "POST", body: [] });
	expect(callTimes).toHaveLength(2);
	expect(callTimes[1]! - callTimes[0]!).toBeGreaterThanOrEqual(115);
});

test("a stopped caller leaves the queue instead of waiting for a slot", async () => {
	let release!: () => void;
	const gate = new Promise<void>((resolve) => (release = resolve));
	const started: string[] = [];
	const request = client(
		asFetch(async (url) => {
			started.push(url);
			await gate;
			return ok();
		}),
		{ maxInFlight: 1 },
	);
	const running = request("/running");
	const controller = new AbortController();
	const queued = request("/queued", { signal: controller.signal });
	const after = request("/after");
	controller.abort();
	await expect(queued).rejects.toThrow();
	release();
	await Promise.all([running, after]);
	expect(started.map((url) => url.split("/").at(-1))).toEqual(["running", "after"]);
});

test("a stopped caller does not finish its backoff", async () => {
	const controller = new AbortController();
	let calls = 0;
	const request = client(asFetch(async () => (calls++, ok(40202))), { retryBaseMs: 10_000 });
	const pending = request("/x", { method: "POST", body: [], signal: controller.signal });
	await Bun.sleep(20);
	const stoppedAt = Date.now();
	controller.abort();
	await expect(pending).rejects.toThrow();
	expect(Date.now() - stoppedAt).toBeLessThan(500);
	expect(calls).toBe(1);
});

test("an already stopped caller never reaches DataForSEO", async () => {
	let calls = 0;
	const request = client(asFetch(async () => (calls++, ok())));
	await expect(request("/x", { signal: AbortSignal.abort() })).rejects.toThrow();
	expect(calls).toBe(0);
});

test("an abort during the HTTP call is not retried", async () => {
	const controller = new AbortController();
	let calls = 0;
	const request = client(
		asFetch(async (_url, init) => {
			calls++;
			await new Promise((_, reject) =>
				init.signal.addEventListener("abort", () => reject(init.signal.reason)),
			);
		}),
	);
	const pending = request("/x", { signal: controller.signal });
	await Bun.sleep(5);
	controller.abort();
	await expect(pending).rejects.toThrow();
	expect(calls).toBe(1);
});
