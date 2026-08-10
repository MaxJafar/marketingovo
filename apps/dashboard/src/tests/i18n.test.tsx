import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { I18nProvider, fmt, resolveInitialLocale, useI18n } from "../i18n";
import {
  LOCALES,
  LOCALE_LABELS,
  LOCALE_STORAGE_KEY,
  matchBrowserLocale,
} from "../i18n/locales";
import { routeTitleForPathname } from "../components/app-shell";
import { en } from "../i18n/messages/en";
import { az } from "../i18n/messages/az";
import { de } from "../i18n/messages/de";
import { es } from "../i18n/messages/es";
import { nl } from "../i18n/messages/nl";
import { ru } from "../i18n/messages/ru";
import type { Messages } from "../i18n/messages/types";

const CATALOG: Record<string, Messages> = { en, az, de, ru, nl, es };

/** Depth-first list of every leaf string with its dotted path. */
function leaves(
  node: unknown,
  path = "",
  found: Array<[string, string]> = [],
): Array<[string, string]> {
  if (typeof node === "string") {
    found.push([path, node]);
    return found;
  }
  if (Array.isArray(node)) {
    node.forEach((item, index) => leaves(item, `${path}[${index}]`, found));
    return found;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      leaves(value, path ? `${path}.${key}` : key, found);
    }
  }
  return found;
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/gu)].map((match) => match[1]).sort();
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("message catalogs", () => {
  const reference = leaves(en);
  const referencePaths = reference.map(([path]) => path);

  for (const code of LOCALES) {
    it(`locale "${code}" mirrors the en key tree with matching placeholders`, () => {
      const catalog = CATALOG[code];
      const translated = new Map(leaves(catalog));

      // Same paths, nothing missing and nothing extra.
      expect([...translated.keys()].sort()).toEqual([...referencePaths].sort());

      for (const [path, english] of reference) {
        const value = translated.get(path);
        expect(value, path).toBeTypeOf("string");
        // A blank translation would render as a hole in the UI.
        expect(value!.trim().length, path).toBeGreaterThan(0);
        // Interpolation markers must survive translation exactly.
        expect(placeholders(value!), path).toEqual(placeholders(english));
      }
    });
  }
});

describe("fmt", () => {
  it("substitutes named markers and leaves unknown ones visible", () => {
    expect(
      fmt("{connected}/{total} sources live", { connected: 2, total: 3 }),
    ).toBe("2/3 sources live");
    expect(fmt("missing {marker}", {})).toBe("missing {marker}");
  });
});

describe("locale resolution", () => {
  it("matches the first supported browser language by base tag", () => {
    expect(matchBrowserLocale(["de-DE", "en-US"])).toBe("de");
    expect(matchBrowserLocale(["pt-BR", "fr-FR"])).toBeUndefined();
    expect(matchBrowserLocale(["AZ"])).toBe("az");
  });

  it("prefers a stored locale over the browser language", () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "nl");
    expect(resolveInitialLocale()).toBe("nl");
  });

  it("falls back to en when storage holds an unknown value", () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "tlh");
    expect(resolveInitialLocale()).toBe("en");
  });
});

describe("route titles", () => {
  it("resolves titles from the supplied catalog", () => {
    expect(routeTitleForPathname("/", en)).toBe(en.shell.navTitle.dashboard);
    expect(routeTitleForPathname("/settings", en)).toBe(
      en.shell.secondaryTitle.settings,
    );
    expect(routeTitleForPathname("/audits/run-1", en)).toBe(
      en.shell.secondaryTitle.auditDetails,
    );
    expect(routeTitleForPathname("/nowhere", en)).toBe(en.shell.notFoundTitle);
    expect(routeTitleForPathname("/", ru)).toBe(ru.shell.navTitle.dashboard);
  });
});

function Probe() {
  const { t, locale, setLocale } = useI18n();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="language-title">{t.settings.languageTitle}</span>
      <button type="button" onClick={() => setLocale("ru")}>
        to-ru
      </button>
      <button type="button" onClick={() => setLocale("en")}>
        to-en
      </button>
    </div>
  );
}

describe("I18nProvider", () => {
  it("defaults to en, switches locale, persists, and stamps <html lang>", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    expect(screen.getByTestId("locale").textContent).toBe("en");
    expect(screen.getByTestId("language-title").textContent).toBe(
      en.settings.languageTitle,
    );

    await user.click(screen.getByRole("button", { name: "to-ru" }));
    expect(screen.getByTestId("locale").textContent).toBe("ru");
    expect(screen.getByTestId("language-title").textContent).toBe(
      ru.settings.languageTitle,
    );
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("ru");
    expect(document.documentElement.lang).toBe("ru");

    // Leave the module-level locale back on the reference language so later
    // tests in this file observe the default state.
    await user.click(screen.getByRole("button", { name: "to-en" }));
    expect(document.documentElement.lang).toBe("en");
  });

  it("offers every advertised locale a native-language label", () => {
    for (const code of LOCALES) {
      expect(LOCALE_LABELS[code].trim().length).toBeGreaterThan(0);
    }
  });
});
