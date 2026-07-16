// Structural HTML diagnostics that affect mobile rendering, crawl cost, and
// deterministic DOM targeting. These are evidence-first checks: thresholds and
// offending values are included in detail so the UI can explain every result.

import type { CheckFn, CrawlIndex, Issue } from "./index.js";

const LARGE_DOM_THRESHOLD = 1_500;

export const markupChecks: CheckFn[] = [
  function viewportMissingOrEmpty(index: CrawlIndex): Issue[] {
    const pages = [...index.pages.values()].filter(
      (page) =>
        page.status === 200 &&
        page.parsed &&
        (!page.parsed.hasViewport || !page.parsed.viewportContent),
    );
    if (pages.length === 0) return [];
    return [
      {
        id: "viewport-missing-or-empty",
        category: "Mobile",
        priority: "High",
        message: `${pages.length} HTML page(s) have no usable viewport meta declaration.`,
        urls: pages.map((page) => page.url),
        detail: {
          pages: pages.map((page) => ({
            url: page.url,
            tagPresent: page.parsed?.hasViewport ?? false,
            content: page.parsed?.viewportContent ?? null,
          })),
        },
      },
    ];
  },

  function duplicateDomIds(index: CrawlIndex): Issue[] {
    const pages = [...index.pages.values()].filter(
      (page) =>
        page.status === 200 &&
        page.parsed &&
        page.parsed.duplicateIds.length > 0,
    );
    if (pages.length === 0) return [];
    return [
      {
        id: "duplicate-dom-id",
        category: "Markup",
        priority: "Low",
        message: `${pages.length} page(s) reuse one or more non-empty HTML id values.`,
        urls: pages.map((page) => page.url),
        detail: {
          pages: pages.map((page) => ({
            url: page.url,
            duplicateIds: page.parsed?.duplicateIds ?? [],
          })),
        },
      },
    ];
  },

  function largeDom(index: CrawlIndex): Issue[] {
    const pages = [...index.pages.values()]
      .filter(
        (page) =>
          page.status === 200 &&
          page.parsed &&
          page.parsed.domNodeCount > LARGE_DOM_THRESHOLD,
      )
      .sort(
        (a, b) => (b.parsed?.domNodeCount ?? 0) - (a.parsed?.domNodeCount ?? 0),
      );
    if (pages.length === 0) return [];
    return [
      {
        id: "large-dom",
        category: "Performance",
        priority: "Medium",
        message: `${pages.length} page(s) exceed the ${LARGE_DOM_THRESHOLD.toLocaleString("en-US")}-element DOM diagnostic threshold.`,
        urls: pages.map((page) => page.url),
        detail: {
          threshold: LARGE_DOM_THRESHOLD,
          thresholdKind: "diagnostic",
          pages: pages.map((page) => ({
            url: page.url,
            elements: page.parsed?.domNodeCount ?? 0,
          })),
        },
      },
    ];
  },
];
