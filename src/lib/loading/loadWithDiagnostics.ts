export type LoadFailure = {
	operation: string;
	durationMs: number;
	error: unknown;
};

export function isCancelledLoad(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	return (
		("name" in error && error.name === "AbortError") ||
		("status" in error &&
			typeof error.status === "number" &&
			error.status >= 300 &&
			error.status < 400)
	);
}

// Remote queries are thenables. Racing them also covers failures while reading
// the response body, after fetch has already received successful HTTP headers.
export async function loadWithDiagnostics<T>(
	operation: string,
	load: () => PromiseLike<T>,
	onError: (failure: LoadFailure) => void,
	timeoutMs = 30_000,
): Promise<T> {
	const startedAt = performance.now();
	let timeout: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			// Invoke synchronously so Svelte can track remote queries in the caller's effect.
			load(),
			new Promise<never>((_, reject) => {
				timeout = setTimeout(() => {
					const error = new Error(`Loading ${operation} exceeded ${timeoutMs}ms`);
					error.name = "TimeoutError";
					reject(error);
				}, timeoutMs);
			}),
		]);
	} catch (error) {
		if (!isCancelledLoad(error)) {
			onError({ operation, durationMs: Math.round(performance.now() - startedAt), error });
		}
		throw error;
	} finally {
		clearTimeout(timeout);
	}
}
