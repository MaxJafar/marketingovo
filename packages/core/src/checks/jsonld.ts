// JSON-LD validation check: each <script type="application/ld+json">
// block must parse as JSON.

import type { CheckFn, CrawlIndex, Issue } from "./index.js";

export const jsonLdChecks: CheckFn[] = [
  function jsonLdInvalid(index: CrawlIndex): Issue[] {
    const broken: Array<{ url: string; snippet: string }> = [];
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed) continue;
      for (const block of p.parsed.jsonLd) {
        try {
          JSON.parse(block);
        } catch (err) {
          broken.push({
            url: p.url,
            snippet: block.slice(0, 120),
          });
          void err;
        }
      }
    }
    if (broken.length === 0) return [];
    return [
      {
        id: "jsonld-parse-error",
        category: "Structured Data",
        priority: "Medium",
        message: `${broken.length} JSON-LD block(s) failed to parse.`,
        urls: [...new Set(broken.map((b) => b.url))],
        detail: {
          samples: broken
            .slice(0, 3)
            .map((b) => ({ url: b.url, snippet: b.snippet })),
        },
      },
    ];
  },
];
