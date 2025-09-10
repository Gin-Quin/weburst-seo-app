import { derived, type Readable, writable } from "svelte/store";

export const locales = ["en", "fr"] as const;

export type Locale = (typeof locales)[number];

let currentLocale: Locale = "fr";
export const locale = writable<Locale>(currentLocale);

locale.subscribe(($locale) => (currentLocale = $locale));

type Exactly<T> = T & {};

export function defineContent<T>(
	content: { en: T } & Record<Exclude<Locale, "en">, Exactly<T>>,
): Readable<T> {
	return derived(locale, ($locale) => content[$locale]);
}
