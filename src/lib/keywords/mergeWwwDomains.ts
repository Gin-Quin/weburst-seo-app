const WWW_PREFIX = /^www\./;

/**
 * Older analyses stored `www.example.com` and `example.com` as separate domains.
 * Merge them under the bare host, summing `sumKeys` and keeping the other fields
 * (e.g. trend) of the row with the highest volume. `groupBy` scopes the merge
 * (e.g. per analysis date).
 */
export function mergeWwwDomains<T extends { domain: string; volume: number }>(
	rows: ReadonlyArray<T>,
	sumKeys: ReadonlyArray<Exclude<keyof T, "domain">>,
	groupBy: (row: T) => string = () => "",
): T[] {
	const merged = new Map<string, T>();
	for (const row of rows) {
		const domain = row.domain.replace(WWW_PREFIX, "");
		const key = `${groupBy(row)}\0${domain}`;
		const existing = merged.get(key);
		const next = { ...(existing && existing.volume >= row.volume ? existing : row), domain };
		for (const sumKey of sumKeys) {
			(next as Record<keyof T, unknown>)[sumKey] =
				Number(row[sumKey]) + (existing ? Number(existing[sumKey]) : 0);
		}
		merged.set(key, next);
	}
	return [...merged.values()];
}
