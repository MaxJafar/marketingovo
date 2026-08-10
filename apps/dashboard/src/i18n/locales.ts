/**
 * The languages the console ships in. Adding one is three steps: a code here,
 * a `messages/<code>/` directory that satisfies the `en` shape, and an entry in
 * the catalog in `index.tsx` — the types then refuse to build until every
 * namespace is translated.
 */
export const LOCALES = ["en", "az", "de", "ru", "nl", "es"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_STORAGE_KEY = "marketingovo:locale:v1";

/**
 * Each language named in itself, never translated: a reader lost in the wrong
 * locale must still recognise their own language in the picker.
 */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  az: "Azərbaycanca",
  de: "Deutsch",
  ru: "Русский",
  nl: "Nederlands",
  es: "Español",
};

/**
 * BCP 47 tags handed to Intl formatters. `en` stays `en-US` because that is
 * what every number and date in the product rendered before localisation.
 */
export const INTL_LOCALES: Record<Locale, string> = {
  en: "en-US",
  az: "az-Latn-AZ",
  de: "de-DE",
  ru: "ru-RU",
  nl: "nl-NL",
  es: "es-ES",
};

export function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** First supported language in the browser's preference list, if any. */
export function matchBrowserLocale(
  languages: readonly string[],
): Locale | undefined {
  for (const language of languages) {
    const base = language.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return undefined;
}
