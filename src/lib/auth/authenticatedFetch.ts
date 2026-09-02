type BearerTokenReader = () => string | null;

export function createAuthenticatedFetch(
	originalFetch: typeof fetch,
	getBearerToken: BearerTokenReader,
	appOrigin: string,
): typeof fetch {
	const origin = new URL(appOrigin).origin;

	return ((input: RequestInfo | URL, init?: RequestInit) => {
		const inputUrl = input instanceof Request ? input.url : input.toString();
		const requestUrl = new URL(inputUrl, origin);
		const bearerToken = getBearerToken();

		if (!bearerToken || requestUrl.origin !== origin) {
			return originalFetch(input, init);
		}

		const headers = new Headers(
			init?.headers ?? (input instanceof Request ? input.headers : undefined),
		);
		headers.set("Authorization", `Bearer ${bearerToken}`);

		return originalFetch(input, {
			...init,
			headers,
		});
	}) as typeof fetch;
}
