const BASE_URL = "https://api.dataforseo.com";
/** "The rate-limit per minute has been exceeded." Returned in the body of an otherwise valid response. */
const RATE_LIMITED = 40202;

type ApiResponse = { status_code: number; status_message: string };

export type DataForSeoRequest = {
	method?: "GET" | "POST";
	body?: unknown;
	signal?: AbortSignal;
};

export type DataForSeoClientOptions = {
	authorization: () => string;
	/** Simultaneous HTTP calls. */
	maxInFlight?: number;
	/** DataForSEO allows 2000 calls/min per account; keep headroom for other tools sharing it. */
	maxCallsPerWindow?: number;
	windowMs?: number;
	maxAttempts?: number;
	retryBaseMs?: number;
	fetch?: typeof fetch;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	signal?.throwIfAborted();
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			clearTimeout(timer);
			reject(signal!.reason);
		};
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

/**
 * Every DataForSEO call goes through one client: a cap on simultaneous calls, a per-minute call
 * budget (retries included), and exponential backoff when DataForSEO reports a rate limit.
 * The limits are per process, which matches the single production service.
 */
export function createDataForSeoClient({
	authorization,
	maxInFlight = 10,
	maxCallsPerWindow = 1200,
	windowMs = 60_000,
	maxAttempts = 5,
	retryBaseMs = 5_000,
	fetch: fetchImpl,
}: DataForSeoClientOptions) {
	const queue: Array<() => void> = [];
	const starts: number[] = [];
	let inFlight = 0;
	let pausedUntil = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;

	function pump() {
		clearTimeout(timer);
		timer = undefined;
		const now = Date.now();
		while (starts.length && starts[0]! <= now - windowMs) starts.shift();
		while (queue.length && inFlight < maxInFlight) {
			const waitMs = Math.max(
				pausedUntil - now,
				starts.length >= maxCallsPerWindow ? starts[0]! + windowMs - now : 0,
			);
			if (waitMs > 0) {
				timer = setTimeout(pump, waitMs);
				return;
			}
			starts.push(now);
			inFlight++;
			queue.shift()!();
		}
	}

	async function limited<T>(call: () => Promise<T>, signal?: AbortSignal): Promise<T> {
		signal?.throwIfAborted();
		await new Promise<void>((resolve, reject) => {
			const waiter = () => {
				signal?.removeEventListener("abort", onAbort);
				resolve();
			};
			// A caller that is stopped while queued must not keep waiting for a slot.
			const onAbort = () => {
				queue.splice(queue.indexOf(waiter), 1);
				reject(signal!.reason);
			};
			signal?.addEventListener("abort", onAbort, { once: true });
			queue.push(waiter);
			pump();
		});
		try {
			return await call();
		} finally {
			inFlight--;
			pump();
		}
	}

	async function attempt<T extends ApiResponse>(
		path: string,
		{ method = "GET", body, signal }: DataForSeoRequest,
	): Promise<{ result?: T; error?: Error; retryable: boolean; rateLimited: boolean }> {
		// A failed POST may still have created (and billed) tasks, so only a definitive
		// rate-limit rejection is safe to repeat for it.
		const idempotent = method === "GET";
		let response: Response;
		try {
			response = await limited(
				() =>
					(fetchImpl ?? fetch)(BASE_URL + path, {
						method,
						headers: { Authorization: authorization(), "Content-Type": "application/json" },
						body: body === undefined ? undefined : JSON.stringify(body),
						signal,
					}),
				signal,
			);
		} catch (error) {
			if (signal?.aborted) throw error;
			return { error: error as Error, retryable: idempotent, rateLimited: false };
		}
		if (response.status === 429) {
			return { error: new Error("DataForSEO HTTP 429"), retryable: true, rateLimited: true };
		}
		if (!response.ok) {
			const details = (await response.text().catch(() => "")).slice(0, 500);
			return {
				error: new Error(`DataForSEO HTTP ${response.status} ${response.statusText} ${details}`),
				retryable: idempotent && response.status >= 500,
				rateLimited: false,
			};
		}
		const result = (await response.json()) as T;
		const rateLimited = result.status_code === RATE_LIMITED;
		return { result, retryable: rateLimited, rateLimited };
	}

	/**
	 * Returns the parsed body; callers still check `status_code`. A rate limit that outlasts every
	 * attempt is returned as-is (status 40202); transport failures are thrown.
	 */
	return async function request<T extends ApiResponse>(
		path: string,
		options: DataForSeoRequest = {},
	): Promise<T> {
		for (let attemptNumber = 1; ; attemptNumber++) {
			options.signal?.throwIfAborted();
			const { result, error, retryable, rateLimited } = await attempt<T>(path, options);
			if (!retryable || attemptNumber >= maxAttempts) {
				if (result) return result;
				throw error;
			}
			const delayMs = retryBaseMs * 2 ** (attemptNumber - 1) * (1 + Math.random() / 4);
			// Stop every caller, not only this one: the limit is per account.
			if (rateLimited) pausedUntil = Math.max(pausedUntil, Date.now() + delayMs);
			console.warn("[dataforseo-retry]", {
				path: path.replace(/[0-9a-f-]{36}$/, ":id"),
				attempt: attemptNumber,
				delayMs: Math.round(delayMs),
				reason: rateLimited ? "rate-limited" : String(error),
			});
			await sleep(delayMs, options.signal);
		}
	};
}
