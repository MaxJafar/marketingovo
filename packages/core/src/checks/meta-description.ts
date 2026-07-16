// Meta description checks: missing, duplicate, over 155 chars.

import type { CheckFn, CrawlIndex, Issue } from "./index.js";

const META_MAX = 155;
const META_MIN_OK = 30;

export const metaDescriptionChecks: CheckFn[] = [
  function missingMetaDescription(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed) continue;
      if (!p.parsed.metaDescription || p.parsed.metaDescription.length === 0) {
        urls.push(p.url);
      }
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "meta-description-missing",
        category: "Meta Description",
        priority: "Medium",
        message: `${urls.length} indexable URL(s) have no meta description.`,
        urls,
      },
    ];
  },

  function duplicateMetaDescription(index: CrawlIndex): Issue[] {
    const map = new Map<string, string[]>();
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed?.metaDescription) continue;
      const k = p.parsed.metaDescription.toLowerCase().trim();
      if (k.length < META_MIN_OK) continue;
      const arr = map.get(k) ?? [];
      arr.push(p.url);
      map.set(k, arr);
    }
    const issues: Issue[] = [];
    for (const [meta, list] of map) {
      if (list.length < 2) continue;
      issues.push({
        id: "meta-description-duplicate",
        category: "Meta Description",
        priority: "Low",
        message: `Meta description used on ${list.length} URLs.`,
        urls: list,
        detail: { sample: meta.slice(0, 80) + (meta.length > 80 ? "…" : "") },
      });
    }
    return issues;
  },

  function longMetaDescription(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed?.metaDescription) continue;
      if (p.parsed.metaDescription.length > META_MAX) urls.push(p.url);
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "meta-description-over-155-chars",
        category: "Meta Description",
        priority: "Low",
        message: `${urls.length} URL(s) have meta descriptions over ${META_MAX} characters.`,
        urls,
      },
    ];
  },
];
