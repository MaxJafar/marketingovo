// hreflang consistency check: for each page that declares hreflang,
// the reciprocating page must exist and have a matching hreflang
// link that points back.

import type { CheckFn, CrawlIndex, CrawledPage, Issue } from "./index.js";

export type HreflangTargetState =
  "self" | "crawled" | "not_crawled" | "invalid";

export type HreflangReciprocalState =
  | "matched"
  | "missing"
  | "language_mismatch"
  | "not_applicable"
  | "unavailable";

export interface HreflangAlternateEvidence {
  lang: string;
  declaredUrl: string;
  resolvedUrl: string | null;
  selfReference: boolean;
  targetState: HreflangTargetState;
  targetStatusCode: number | null;
  reciprocal: HreflangReciprocalState;
  expectedReturnLanguage: string | null;
  observedReturnLanguages: string[];
}

export interface HreflangPageEvidence {
  sourceUrl: string;
  finalUrl: string;
  htmlLang: string | null;
  selfLanguage: string | null;
  hasXDefault: boolean;
  alternates: HreflangAlternateEvidence[];
}

/**
 * Build one canonical hreflang matrix for both checks and operator evidence.
 *
 * The language on a reciprocal link describes the source page, not the page
 * it is emitted from. For example, an English page can declare a French
 * target and the French page correctly returns with `hreflang="en"`. The old
 * implementation compared that return value with `fr`, which produced a false
 * mismatch for a valid pair.
 */
export function analyzeHreflang(
  index: CrawlIndex,
): Map<string, HreflangPageEvidence> {
  const aliases = new Map<string, CrawledPage>();
  for (const page of index.pages.values()) {
    const requested = resourceUrl(page.url);
    const final = resourceUrl(page.finalUrl);
    if (requested) aliases.set(requested, page);
    if (final && !aliases.has(final)) aliases.set(final, page);
  }

  const matrix = new Map<string, HreflangPageEvidence>();
  for (const page of index.pages.values()) {
    if (!page.parsed || page.parsed.hreflang.length === 0) continue;
    const sourceIdentities = new Set(
      [resourceUrl(page.url), resourceUrl(page.finalUrl)].filter(
        (value): value is string => value !== null,
      ),
    );
    const selfLanguage =
      page.parsed.hreflang.find((entry) => {
        if (entry.lang.trim().toLowerCase() === "x-default") return false;
        const resolved = resourceUrl(entry.href, page.finalUrl);
        return resolved !== null && sourceIdentities.has(resolved);
      })?.lang ?? null;

    const alternates = page.parsed.hreflang.map((entry) => {
      const resolvedUrl = resourceUrl(entry.href, page.finalUrl);
      const selfReference =
        resolvedUrl !== null && sourceIdentities.has(resolvedUrl);
      const target = resolvedUrl ? aliases.get(resolvedUrl) : undefined;
      const targetState: HreflangTargetState = !resolvedUrl
        ? "invalid"
        : selfReference
          ? "self"
          : target
            ? "crawled"
            : "not_crawled";

      let reciprocal: HreflangReciprocalState = "unavailable";
      let observedReturnLanguages: string[] = [];
      if (selfReference) {
        reciprocal = "not_applicable";
      } else if (target) {
        const returning = (target.parsed?.hreflang ?? []).filter(
          (candidate) => {
            const back = resourceUrl(candidate.href, target.finalUrl);
            return back !== null && sourceIdentities.has(back);
          },
        );
        observedReturnLanguages = [
          ...new Set(returning.map((candidate) => candidate.lang)),
        ];
        if (returning.length === 0) {
          reciprocal = "missing";
        } else if (
          selfLanguage &&
          !returning.some(
            (candidate) =>
              candidate.lang.trim().toLowerCase() ===
              selfLanguage.trim().toLowerCase(),
          )
        ) {
          reciprocal = "language_mismatch";
        } else {
          reciprocal = "matched";
        }
      }

      return {
        lang: entry.lang,
        declaredUrl: entry.href,
        resolvedUrl,
        selfReference,
        targetState,
        targetStatusCode: target?.status ?? null,
        reciprocal,
        expectedReturnLanguage: selfLanguage,
        observedReturnLanguages,
      } satisfies HreflangAlternateEvidence;
    });

    matrix.set(page.url, {
      sourceUrl: page.url,
      finalUrl: page.finalUrl,
      htmlLang: page.parsed.htmlLang,
      selfLanguage,
      hasXDefault: page.parsed.hreflang.some(
        (entry) => entry.lang.trim().toLowerCase() === "x-default",
      ),
      alternates,
    });
  }
  return matrix;
}

export const hreflangChecks: CheckFn[] = [
  function hreflangMissingReciprocal(index: CrawlIndex): Issue[] {
    const issues: Issue[] = [];
    const seen = new Set<string>();
    for (const page of analyzeHreflang(index).values()) {
      for (const alternate of page.alternates) {
        if (alternate.selfReference) continue;
        const targetLabel = alternate.resolvedUrl ?? alternate.declaredUrl;
        if (
          alternate.targetState === "invalid" ||
          alternate.targetState === "not_crawled"
        ) {
          const key = `missing-target|${page.sourceUrl}|${targetLabel}`;
          if (!seen.has(key)) {
            seen.add(key);
            issues.push({
              id: "hreflang-target-missing",
              category: "Hreflang",
              priority: "Medium",
              message: `hreflang target not crawled: ${targetLabel} (declared by ${page.sourceUrl})`,
              urls: [page.sourceUrl, targetLabel],
              detail: { alternate },
            });
          }
          continue;
        }
        if (alternate.reciprocal === "language_mismatch") {
          const key = `lang-mismatch|${page.sourceUrl}|${targetLabel}`;
          if (!seen.has(key)) {
            seen.add(key);
            issues.push({
              id: "hreflang-lang-mismatch",
              category: "Hreflang",
              priority: "Medium",
              message: `hreflang reciprocal language mismatch: ${targetLabel} links back to ${page.sourceUrl} with ${alternate.observedReturnLanguages.join(", ") || "an unknown language"}; expected ${alternate.expectedReturnLanguage ?? "the source language"}.`,
              urls: [page.sourceUrl, targetLabel],
              detail: { alternate },
            });
          }
        } else if (alternate.reciprocal === "missing") {
          const key = `no-reciprocal|${page.sourceUrl}|${targetLabel}`;
          if (!seen.has(key)) {
            seen.add(key);
            issues.push({
              id: "hreflang-no-reciprocal",
              category: "Hreflang",
              priority: "Medium",
              message: `hreflang declared on ${page.sourceUrl} (${alternate.lang}) has no reciprocal link from ${targetLabel}`,
              urls: [page.sourceUrl, targetLabel],
              detail: { alternate },
            });
          }
        }
      }
    }
    return issues;
  },

  function hreflangMissingSelfReference(index: CrawlIndex): Issue[] {
    const pages: string[] = [];
    for (const page of index.pages.values()) {
      if (page.status !== 200 || !page.parsed) continue;
      if (page.parsed.hreflang.length === 0) continue;
      const ownUrl = resourceUrl(page.finalUrl);
      const hasSelfReference = page.parsed.hreflang.some((entry) => {
        if (entry.lang.trim().toLowerCase() === "x-default") return false;
        return resourceUrl(entry.href, page.finalUrl) === ownUrl;
      });
      if (!hasSelfReference) pages.push(page.url);
    }
    if (pages.length === 0) return [];
    return [
      {
        id: "hreflang-self-reference-missing",
        category: "Hreflang",
        priority: "Medium",
        message: `${pages.length} page(s) declare hreflang alternates without a language-specific self-reference.`,
        urls: pages,
      },
    ];
  },

  function hreflangXDefaultMissing(index: CrawlIndex): Issue[] {
    const pages: string[] = [];
    for (const page of index.pages.values()) {
      if (page.status !== 200 || !page.parsed) continue;
      if (page.parsed.hreflang.length === 0) continue;
      const hasDefault = page.parsed.hreflang.some(
        (entry) => entry.lang.trim().toLowerCase() === "x-default",
      );
      if (!hasDefault) pages.push(page.url);
    }
    if (pages.length === 0) return [];
    return [
      {
        id: "hreflang-x-default-missing",
        category: "Hreflang",
        priority: "Low",
        message: `${pages.length} page(s) have hreflang alternates but no x-default fallback. Review whether a language selector or default market needs one.`,
        urls: pages,
        detail: { intentRequired: true },
      },
    ];
  },

  function hreflangRelativeUrls(index: CrawlIndex): Issue[] {
    const pages: Array<{ url: string; hrefs: string[] }> = [];
    for (const page of index.pages.values()) {
      if (page.status !== 200 || !page.parsed) continue;
      const hrefs = page.parsed.hreflang
        .map((entry) => entry.href)
        .filter((href) => !isAbsoluteHttpUrl(href));
      if (hrefs.length > 0) pages.push({ url: page.url, hrefs });
    }
    if (pages.length === 0) return [];
    return [
      {
        id: "hreflang-relative-url",
        category: "Hreflang",
        priority: "Medium",
        message: `${pages.length} page(s) use relative or invalid hreflang URLs instead of fully qualified HTTP(S) URLs.`,
        urls: pages.map((page) => page.url),
        detail: { pages },
      },
    ];
  },

  function hreflangHtmlLanguageMismatch(index: CrawlIndex): Issue[] {
    const pages: Array<{ url: string; htmlLang: string; hreflang: string }> =
      [];
    for (const page of index.pages.values()) {
      if (page.status !== 200 || !page.parsed?.htmlLang) continue;
      const ownUrl = resourceUrl(page.finalUrl);
      const self = page.parsed.hreflang.find(
        (entry) =>
          entry.lang.trim().toLowerCase() !== "x-default" &&
          resourceUrl(entry.href, page.finalUrl) === ownUrl,
      );
      if (!self) continue;
      if (
        primaryLanguage(self.lang) === primaryLanguage(page.parsed.htmlLang)
      ) {
        continue;
      }
      pages.push({
        url: page.url,
        htmlLang: page.parsed.htmlLang,
        hreflang: self.lang,
      });
    }
    if (pages.length === 0) return [];
    return [
      {
        id: "hreflang-html-lang-mismatch",
        category: "Hreflang",
        priority: "Medium",
        message: `${pages.length} page(s) have a self-referencing hreflang whose language conflicts with the HTML lang attribute.`,
        urls: pages.map((page) => page.url),
        detail: { pages },
      },
    ];
  },
];

function resourceUrl(value: string, base?: string): string | null {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function primaryLanguage(value: string): string {
  return value.trim().toLowerCase().split("-")[0] ?? "";
}
