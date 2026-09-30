import { extractHost } from "./serpAnalytics";

type Counts = { domain: string; topTenKeywordCount: number; topThreeKeywordCount: number };
export type KeywordCountChange = { positioned: number; topThree: number };

// "Positioned" means top 10 since the 2026-08 analytics change; older rows stored top 50 in positionnedKeywordCount,
// so compare topTenKeywordCount to stay like-for-like.
// Keyed by host without "www." so a domain stored differently across analyses still matches.
export function getKeywordCountChanges(current: Counts[], previous: Counts[]): Record<string, KeywordCountChange> {
	const currentByDomain = new Map(current.map((row) => [extractHost(row.domain), row]));
	const previousByDomain = new Map(previous.map((row) => [extractHost(row.domain), row]));
	return Object.fromEntries([...new Set([...currentByDomain.keys(), ...previousByDomain.keys()])].map((domain) => {
		const now = currentByDomain.get(domain);
		const before = previousByDomain.get(domain);
		return [domain, {
			positioned: (now?.topTenKeywordCount ?? 0) - (before?.topTenKeywordCount ?? 0),
			topThree: (now?.topThreeKeywordCount ?? 0) - (before?.topThreeKeywordCount ?? 0),
		}];
	}));
}
