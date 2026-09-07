type Counts = { domain: string; positionnedKeywordCount: number; topThreeKeywordCount: number };
export type KeywordCountChange = { positioned: number; topThree: number };

export function getKeywordCountChanges(current: Counts[], previous: Counts[]): Record<string, KeywordCountChange> {
	const currentByDomain = new Map(current.map((row) => [row.domain, row]));
	const previousByDomain = new Map(previous.map((row) => [row.domain, row]));
	return Object.fromEntries([...new Set([...currentByDomain.keys(), ...previousByDomain.keys()])].map((domain) => {
		const now = currentByDomain.get(domain);
		const before = previousByDomain.get(domain);
		return [domain, {
			positioned: (now?.positionnedKeywordCount ?? 0) - (before?.positionnedKeywordCount ?? 0),
			topThree: (now?.topThreeKeywordCount ?? 0) - (before?.topThreeKeywordCount ?? 0),
		}];
	}));
}
