import { getLocale } from "$lib/i18n/locale.svelte";

/**
 * Format a number to one decimal place, or no decimal place if it's an integer.
 */
export function formatOneDecimal(value: number, locale = getLocale()): string {
	const decimal = new Intl.NumberFormat(locale, {
		style: "decimal",
		minimumFractionDigits: 0,
		maximumFractionDigits: 1,
	}).format(value);

	return decimal;
}
