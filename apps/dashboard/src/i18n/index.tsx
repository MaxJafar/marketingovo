import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  INTL_LOCALES,
  LOCALE_STORAGE_KEY,
  isLocale,
  matchBrowserLocale,
  type Locale,
} from "./locales";
import { az } from "./messages/az";
import { de } from "./messages/de";
import { en } from "./messages/en";
import { es } from "./messages/es";
import { nl } from "./messages/nl";
import { ru } from "./messages/ru";
import type { Messages } from "./messages/types";

export { LOCALES, LOCALE_LABELS, type Locale } from "./locales";
export type { Messages } from "./messages/types";

const CATALOG: Record<Locale, Messages> = { en, az, de, ru, nl, es };

function readStoredLocale(): Locale | undefined {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

export function resolveInitialLocale(): Locale {
  return (
    readStoredLocale() ??
    matchBrowserLocale(navigator.languages ?? [navigator.language]) ??
    DEFAULT_LOCALE
  );
}

/**
 * The active locale, readable outside React. Formatters and route-title
 * helpers are plain functions called from render paths and tests; they read
 * this instead of threading a hook through every call site. The provider is
 * the only writer, so the two views cannot drift within a commit.
 */
let activeLocale: Locale = DEFAULT_LOCALE;

export function getMessages(): Messages {
  return CATALOG[activeLocale];
}

export function currentIntlLocale(): string {
  return INTL_LOCALES[activeLocale];
}

/** Replaces `{name}` markers; unknown markers stay visible for debugging. */
export function fmt(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/gu, (marker, key: string) =>
    key in values ? String(values[key]) : marker,
  );
}

interface I18nContextValue {
  locale: Locale;
  t: Messages;
  setLocale: (locale: Locale) => void;
}

/**
 * The default value keeps provider-less trees — unit tests render components
 * directly — on the reference locale rather than crashing on a missing
 * provider.
 */
const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  t: en,
  setLocale: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const initial = resolveInitialLocale();
    activeLocale = initial;
    return initial;
  });

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    activeLocale = next;
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable in locked-down browser contexts; the
      // in-memory selection still applies until the tab closes.
    }
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, t: CATALOG[locale], setLocale }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
