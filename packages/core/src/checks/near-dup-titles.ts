// Near-duplicate title detection using a simple token-shingle
// similarity. Not as accurate as MinHash but good enough to flag
// clusters of titles that share most of their tokens.

import type { CheckFn, CrawlIndex, Issue } from "./index.js";
import { findJaccardPairs } from "./similarity-index.js";

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function shingles(tokens: string[], k = 2): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + k <= tokens.length; i++) {
    out.add(tokens.slice(i, i + k).join(" "));
  }
  return out;
}

const SIM_THRESHOLD = 0.7;
const CLUSTER_MIN = 2;

export const nearDupTitleChecks: CheckFn[] = [
  function nearDuplicateTitles(index: CrawlIndex): Issue[] {
    // Build {key -> {url, set}}.
    const entries: Array<{
      url: string;
      title: string;
      shingles: Set<string>;
    }> = [];
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed?.title) continue;
      const t = p.parsed.title;
      if (t.length < 10) continue;
      entries.push({ url: p.url, title: t, shingles: shingles(tokenize(t)) });
    }
    // Union-Find to group near-duplicates.
    const parent = new Map<number, number>();
    const find = (i: number): number => {
      let r = i;
      while (parent.get(r) !== r) {
        const p = parent.get(r)!;
        parent.set(r, parent.get(p)!);
        r = parent.get(p)!;
      }
      return r;
    };
    const union = (a: number, b: number): void => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };
    for (let i = 0; i < entries.length; i++) parent.set(i, i);

    // Collapse identical non-empty shingle sets before similarity search. This
    // handles large templated-title cohorts without generating every pair.
    const representativeBySet = new Map<string, number>();
    const uniqueEntryIndexes: number[] = [];
    for (let i = 0; i < entries.length; i++) {
      const set = entries[i]!.shingles;
      if (set.size === 0) continue;
      const key = [...set].sort().join("\u0000");
      const representative = representativeBySet.get(key);
      if (representative === undefined) {
        representativeBySet.set(key, i);
        uniqueEntryIndexes.push(i);
      } else {
        union(representative, i);
      }
    }

    const matches = findJaccardPairs(
      uniqueEntryIndexes.map((i) => entries[i]!.shingles),
      SIM_THRESHOLD,
    );
    for (const pair of matches.pairs) {
      union(uniqueEntryIndexes[pair.left]!, uniqueEntryIndexes[pair.right]!);
    }
    const groups = new Map<number, number[]>();
    for (let i = 0; i < entries.length; i++) {
      const r = find(i);
      const arr = groups.get(r) ?? [];
      arr.push(i);
      groups.set(r, arr);
    }
    const issues: Issue[] = [];
    for (const idxs of groups.values()) {
      if (idxs.length < CLUSTER_MIN) continue;
      const urls = idxs.map((i) => entries[i]!.url);
      const sampleTitle = entries[idxs[0]!]!.title;
      issues.push({
        id: "title-near-duplicate",
        category: "Page Titles",
        priority: "Low",
        message: `${urls.length} titles are near-duplicates (Jaccard >= ${SIM_THRESHOLD}). Sample: "${sampleTitle.slice(0, 60)}".`,
        urls,
      });
    }
    return issues;
  },
];
