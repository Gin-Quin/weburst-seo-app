import { removeUrlParam } from "./removeUrlParam";

/**
 * - Remove utm parameters from URL
 * - Remove http:// and https:// from URL
 * - Remove `www.` prefix from URL
 */
export function normalizeUrlForSimilarity(url: string): string {
	let normalized = removeUrlParam(url, ["srsltid", "gclid", "fbclid", "utm"]);

	if (normalized.startsWith("http://")) {
		normalized = normalized.slice("http://".length);
	} else if (normalized.startsWith("https://")) {
		normalized = normalized.slice("https://".length);
	}

	if (normalized.startsWith("www.")) {
		normalized = normalized.slice("www.".length);
	}

	return normalized;
}
