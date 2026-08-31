export function getDefaultVisibleDomains(
	domains: Iterable<string>,
	clientDomain: string,
	limit = 5,
): Array<string> {
	return [...new Set([clientDomain, ...[...domains].slice(0, limit)])];
}
