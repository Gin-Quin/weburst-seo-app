import { extractHost } from "./serpAnalytics";

export function findDomainRow<T extends { domain: string }>(
	rows: ReadonlyArray<T>,
	domain: string,
): T | undefined {
	return rows.find((row) => row.domain === domain)
		?? rows.find((row) => extractHost(row.domain) === extractHost(domain));
}
