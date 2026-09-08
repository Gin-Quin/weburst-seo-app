export function formatTrendPeriod(days: number | undefined, locale: string): string | undefined {
	if (days === undefined) return undefined;
	return locale.startsWith("fr") ? `sur les ${days} derniers jours` : `over the last ${days} days`;
}
