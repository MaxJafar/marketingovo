// Directive (robots meta) checks: noindex on indexable pages,
// nofollow on internal links.

import type { CheckFn, CrawlIndex, Issue } from "./index.js";

export const directiveChecks: CheckFn[] = [
  function noindex(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed) continue;
      const r = p.parsed.robotsMeta?.toLowerCase() ?? "";
      if (r.includes("noindex")) urls.push(p.url);
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "noindex",
        category: "Directives",
        priority: "High",
        message: `${urls.length} URL(s) are marked noindex.`,
        urls,
      },
    ];
  },

  function restrictedSearchPresentation(index: CrawlIndex): Issue[] {
    const noImageIndex: string[] = [];
    const noSnippet: string[] = [];
    for (const page of index.pages.values()) {
      if (page.status !== 200 || !page.parsed) continue;
      const directives = page.parsed.robotsMeta?.toLowerCase() ?? "";
      if (directives.includes("noimageindex")) noImageIndex.push(page.url);
      if (directives.includes("nosnippet")) noSnippet.push(page.url);
    }
    const issues: Issue[] = [];
    if (noImageIndex.length > 0) {
      issues.push({
        id: "noimageindex",
        category: "Directives",
        priority: "Low",
        message: `${noImageIndex.length} URL(s) prevent images on the page from being indexed. Confirm this is intentional.`,
        urls: noImageIndex,
        detail: { intentRequired: true },
      });
    }
    if (noSnippet.length > 0) {
      issues.push({
        id: "nosnippet",
        category: "Directives",
        priority: "Low",
        message: `${noSnippet.length} URL(s) prevent text and video previews in search results. Confirm this is intentional.`,
        urls: noSnippet,
        detail: { intentRequired: true },
      });
    }
    return issues;
  },
];
