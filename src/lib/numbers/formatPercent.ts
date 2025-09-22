import { getLocale } from "$lib/i18n/locale.svelte";

export function formatPercent(
	value: number,
	{ locale = getLocale(), minimumFractionDigits = 0, maximumFractionDigits = 1 } = {},
): string {
	const decimal = new Intl.NumberFormat(locale, {
		style: "decimal",
		minimumFractionDigits,
		maximumFractionDigits,
	}).format(value * 100);

	return `${decimal}%`;
}
