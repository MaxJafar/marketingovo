// Soft-404 detection: pages that return 200 but look like errors.
// Heuristic: title contains common "not found" / "404" phrases AND
// the page is thin (< 50 words).

import type { CheckFn, CrawlIndex, Issue } from "./index.js";

const SOFT_404_TERMS = [
  "not found",
  "404",
  "page not found",
  "oops",
  "does not exist",
  "doesn't exist",
  "no longer available",
  "removed",
  "moved permanently",
];

export const soft404Checks: CheckFn[] = [
  function soft404(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed) continue;
      const title = (p.parsed.title ?? "").toLowerCase();
      if (title.length === 0) continue;
      if (p.parsed.wordCount >= 50) continue;
      if (SOFT_404_TERMS.some((t) => title.includes(t))) {
        urls.push(p.url);
      }
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "soft-404",
        category: "Response Codes",
        priority: "High",
        message: `${urls.length} URL(s) look like soft-404s (200 status, error-y title, thin content).`,
        urls,
      },
    ];
  },
];
