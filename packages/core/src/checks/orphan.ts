// Orphan page check: a 200 page that no other crawled page links to.

import type { CheckFn, CrawlIndex, Issue } from "./index.js";

export const orphanChecks: CheckFn[] = [
  function orphanPages(index: CrawlIndex): Issue[] {
    const linked = new Set<string>();
    for (const p of index.pages.values()) {
      if (!p.parsed) continue;
      for (const l of p.parsed.internalLinks) {
        const key = resourceUrl(l, p.finalUrl);
        if (key) linked.add(key);
      }
    }
    const orphans: string[] = [];
    for (const p of index.pages.values()) {
      if (p.status !== 200) continue;
      // The start URL is never an orphan by definition.
      if (resourceUrl(p.url) === resourceUrl(index.startUrl)) continue;
      const requested = resourceUrl(p.url);
      const final = resourceUrl(p.finalUrl);
      if (
        (!requested || !linked.has(requested)) &&
        (!final || !linked.has(final))
      ) {
        orphans.push(p.url);
      }
    }
    if (orphans.length === 0) return [];
    return [
      {
        id: "orphan-page",
        category: "Links",
        priority: "Medium",
        message: `${orphans.length} crawled page(s) have no internal links pointing to them.`,
        urls: orphans,
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
