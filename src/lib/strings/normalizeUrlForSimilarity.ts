/**
 * Normalize a SERP URL with the same rules as the Python analytics pipeline.
 */
export function normalizeUrlForSimilarity(url: string): string {
	const input = url.trim();
	if (!input) return "";

	try {
		const parsed = new URL(input);
		parsed.hash = "";
		parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");

		for (const key of [...parsed.searchParams.keys()]) {
			const normalizedKey = key.toLowerCase();
			if (
				normalizedKey.startsWith("utm_") ||
				["gclid", "fbclid", "srsltid", "mc_eid", "igshid"].includes(normalizedKey)
			) {
				parsed.searchParams.delete(key);
			}
		}

		if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
			parsed.pathname = parsed.pathname.slice(0, -1);
		}

		return `${parsed.host}${parsed.pathname}${parsed.search}`;
	} catch {
		return "";
	}
}
