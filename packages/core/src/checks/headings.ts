// Heading checks: H1 missing or multiple.

import type { CheckFn, CrawlIndex, Issue } from "./index.js";

export const headingChecks: CheckFn[] = [
  function missingH1(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed) continue;
      if (p.parsed.h1.length === 0) urls.push(p.url);
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "h1-missing",
        category: "H1",
        priority: "High",
        message: `${urls.length} indexable URL(s) have no H1.`,
        urls,
      },
    ];
  },

  function multipleH1(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed) continue;
      if (p.parsed.h1.length > 1) urls.push(p.url);
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "h1-multiple",
        category: "H1",
        priority: "Medium",
        message: `${urls.length} URL(s) have more than one H1.`,
        urls,
      },
    ];
  },
];
