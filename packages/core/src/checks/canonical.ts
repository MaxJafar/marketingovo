// Canonical checks: missing, points to a 4xx/5xx or off-host.

import type { CheckFn, CrawlIndex, Issue } from "./index.js";

export const canonicalChecks: CheckFn[] = [
  function missingCanonical(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed) continue;
      if (!p.parsed.canonical) urls.push(p.url);
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "canonical-missing",
        category: "Canonicals",
        priority: "Low",
        message: `${urls.length} indexable URL(s) have no canonical link.`,
        urls,
      },
    ];
  },

  function canonicalPointsToBroken(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed?.canonical) continue;
      const target = index.pages.get(p.parsed.canonical);
      if (target && target.status >= 400) urls.push(p.url);
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "canonical-broken",
        category: "Canonicals",
        priority: "Medium",
        message: `${urls.length} URL(s) point their canonical to a broken page.`,
        urls,
      },
    ];
  },
];
