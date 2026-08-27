import { getWeightedVolume } from "./getWeightedVolume";

export type SerpAnalyticsRow = {
	keyword: string;
	domain: string;
	position: number;
	type: string;
};

export type DomainMetrics = {
	domain: string;
	estimatedTraffic: number;
	topThreeKeywordCount: number;
	topTenKeywordCount: number;
	positionedKeywordCount: number;
};

export function extractHost(value: string): string {
	const input = value.trim();
	if (!input) return "";

	try {
		const parsed = new URL(input.includes("://") ? input : `http://${input}`);
		return parsed.hostname
			.toLowerCase()
			.replace(/^www\./, "")
			.replace(/\.+$/, "");
	} catch {
		return "";
	}
}

export function hostMatchesTarget(host: string, target: string): boolean {
	const normalizedHost = extractHost(host);
	const normalizedTarget = extractHost(target);
	return (
		Boolean(normalizedHost && normalizedTarget) &&
		(normalizedHost === normalizedTarget || normalizedHost.endsWith(`.${normalizedTarget}`))
	);
}

/** Build phase-4 metrics from the best organic position for each keyword/domain pair. */
export function getDomainMetrics(
	rows: Iterable<SerpAnalyticsRow>,
	keywordVolumes: ReadonlyMap<string, number>,
): DomainMetrics[] {
	const bestPositions = new Map<string, Map<string, number>>();

	for (const row of rows) {
		if (!row.type.toLowerCase().includes("organic")) continue;
		if (!Number.isFinite(row.position) || row.position <= 0) continue;

		const domain = extractHost(row.domain);
		if (!domain || !keywordVolumes.has(row.keyword)) continue;

		const positionsByKeyword = bestPositions.get(domain) ?? new Map<string, number>();
		const previous = positionsByKeyword.get(row.keyword);
		if (previous === undefined || row.position < previous) {
			positionsByKeyword.set(row.keyword, row.position);
		}
		bestPositions.set(domain, positionsByKeyword);
	}

	const metrics: DomainMetrics[] = [];
	for (const [domain, positionsByKeyword] of bestPositions) {
		let estimatedTraffic = 0;
		let topThreeKeywordCount = 0;
		let topTenKeywordCount = 0;

		for (const [keyword, position] of positionsByKeyword) {
			if (position > 10) continue;
			topTenKeywordCount += 1;
			if (position <= 3) topThreeKeywordCount += 1;
			estimatedTraffic += getWeightedVolume(keywordVolumes.get(keyword) ?? 0, position);
		}

		// Like domain_metrics.csv, domains without any top-10 keyword are omitted.
		if (topTenKeywordCount === 0) continue;
		metrics.push({
			domain,
			estimatedTraffic,
			topThreeKeywordCount,
			topTenKeywordCount,
			positionedKeywordCount: topTenKeywordCount,
		});
	}

	return metrics.sort(
		(a, b) => b.estimatedTraffic - a.estimatedTraffic || a.domain.localeCompare(b.domain),
	);
}
