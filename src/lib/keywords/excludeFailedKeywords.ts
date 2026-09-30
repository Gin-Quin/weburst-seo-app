/** Failed crawls are unknown, not unranked keywords or zero-volume successes. */
export function excludeFailedKeywords<T>(
	keywords: ReadonlyMap<string, T>,
	failed: Iterable<string>,
): Map<string, T> {
	const excluded = new Set(failed);
	return new Map([...keywords].filter(([keyword]) => !excluded.has(keyword)));
}
