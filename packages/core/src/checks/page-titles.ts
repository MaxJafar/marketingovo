// Page title checks: missing, duplicate, multiple, too long.

import type { CheckFn, CrawlIndex, Issue, CrawledPage } from "./index.js";

const TITLE_MAX = 60;
const TITLE_MIN_OK = 10;

export const pageTitleChecks: CheckFn[] = [
  function missingTitle(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      if (p.status !== 200) continue;
      if (!p.parsed) continue;
      if (!p.parsed.title || p.parsed.title.length === 0) {
        urls.push(p.url);
      }
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "title-missing",
        category: "Page Titles",
        priority: "High",
        message: `${urls.length} indexable URL(s) have no <title>.`,
        urls,
      },
    ];
  },

  function duplicateTitle(index: CrawlIndex): Issue[] {
    const map = new Map<string, string[]>();
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed?.title) continue;
      const k = p.parsed.title.toLowerCase().trim();
      if (k.length < TITLE_MIN_OK) continue; // short titles are noisy
      const arr = map.get(k) ?? [];
      arr.push(p.url);
      map.set(k, arr);
    }
    const issues: Issue[] = [];
    for (const [title, list] of map) {
      if (list.length < 2) continue;
      issues.push({
        id: "title-duplicate",
        category: "Page Titles",
        priority: "Medium",
        message: `Title "${title}" used on ${list.length} URLs.`,
        urls: list,
      });
    }
    return issues;
  },

  function longTitle(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed?.title) continue;
      if (p.parsed.title.length > TITLE_MAX) urls.push(p.url);
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "title-over-60-chars",
        category: "Page Titles",
        priority: "Low",
        message: `${urls.length} URL(s) have titles over ${TITLE_MAX} characters.`,
        urls,
      },
    ];
  },
];
