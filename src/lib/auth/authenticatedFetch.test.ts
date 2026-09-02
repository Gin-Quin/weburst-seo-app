import { expect, test } from "bun:test";
import { createAuthenticatedFetch } from "./authenticatedFetch";

type FetchCall = {
	input: RequestInfo | URL;
	init?: RequestInit;
};

function createFetchSpy() {
	const calls: FetchCall[] = [];
	const fetchSpy = ((input: RequestInfo | URL, init?: RequestInit) => {
		calls.push({ input, init });
		return Promise.resolve(new Response());
	}) as typeof fetch;

	return { calls, fetchSpy };
}

test("adds the latest bearer token to same-origin requests", async () => {
	const { calls, fetchSpy } = createFetchSpy();
	let bearerToken: string | null = null;
	const authenticatedFetch = createAuthenticatedFetch(
		fetchSpy,
		() => bearerToken,
		"https://app.weburst.fr",
	);

	await authenticatedFetch("/_app/remote/login");
	bearerToken = "new-session";
	await authenticatedFetch("/_app/remote/current-user", {
		headers: { "X-Request": "kept" },
	});

	expect(calls[0]?.init).toBeUndefined();
	const headers = new Headers(calls[1]?.init?.headers);
	expect(headers.get("Authorization")).toBe("Bearer new-session");
	expect(headers.get("X-Request")).toBe("kept");
});

test("does not expose the bearer token to another origin", async () => {
	const { calls, fetchSpy } = createFetchSpy();
	const authenticatedFetch = createAuthenticatedFetch(
		fetchSpy,
		() => "private-session",
		"https://app.weburst.fr",
	);

	await authenticatedFetch("https://example.com/resource");

	expect(calls[0]?.init).toBeUndefined();
});
