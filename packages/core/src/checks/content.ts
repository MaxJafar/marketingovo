// Content quality checks: thin content, exact duplicate body,
// near-duplicate body via MinHash signature, and a simple readability
// score. These complement the title/meta checks with signals that
// affect ranking but aren't usually surfaced by simple crawlers.

import type { CheckFn, CrawlIndex, Issue } from "./index.js";
import { createHash } from "node:crypto";
import { visitPackedSignaturePairs } from "./similarity-index.js";

const THIN_THRESHOLD = 300; // words
const VERY_THIN_THRESHOLD = 100; // words

// Flesch Reading Ease:
//   206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)
// Returns a score 0-100 (higher = easier). English-only approximation
// (syllable heuristic).
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;
  // Drop trailing e, es, ed (silent e)
  const trimmed = w.replace(/(?:e|es|ed)$/, "");
  const groups = trimmed.match(/[aeiouy]+/g);
  return groups ? groups.length : 1;
}

function fleschReadingEase(text: string): number | null {
  if (text.trim().length === 0) return null;
  const sentences = text.split(/[.!?]+\s/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (sentences.length === 0 || words.length === 0) return null;
  let syll = 0;
  for (const w of words) syll += countSyllables(w);
  const score =
    206.835 -
    1.015 * (words.length / sentences.length) -
    84.6 * (syll / words.length);
  return Math.round(score * 10) / 10;
}

function shingleTokens(text: string, k = 5): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + k <= tokens.length; i++) {
    out.add(tokens.slice(i, i + k).join(" "));
  }
  return out;
}

// MinHash: deterministic signature of k shingles using PERMUTE
// hashes. We approximate the permutation with a per-hash linear
// hash, which is enough for similarity estimation at small scale.
const NUM_HASHES = 64;
const HASH_A: number[] = [];
const HASH_B: number[] = [];
for (let i = 0; i < NUM_HASHES; i++) {
  // Fixed primes for stability across runs.
  HASH_A.push(1009 + i * 31);
  HASH_B.push(7919 + i * 17);
}
function minHashSignature(shingles: Set<string>): bigint {
  const sig: number[] = new Array(NUM_HASHES).fill(Number.MAX_SAFE_INTEGER);
  for (const s of shingles) {
    // 32-bit FNV-1a hash of the shingle, kept as a positive 32-bit int.
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    for (let i = 0; i < NUM_HASHES; i++) {
      const v = (HASH_A[i]! * h + HASH_B[i]!) >>> 0;
      if (v < sig[i]!) sig[i] = v;
    }
  }
  // Pack into a single bigint for cheap storage.
  let packed = 0n;
  for (let i = 0; i < NUM_HASHES; i++) {
    packed = (packed << 8n) | BigInt(sig[i]! & 0xff);
  }
  return packed;
}
const NEAR_DUP_THRESHOLD = 0.7;

export const contentChecks: CheckFn[] = [
  function thinContent(index: CrawlIndex): Issue[] {
    const veryThin: string[] = [];
    const thin: string[] = [];
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed) continue;
      const wc = p.parsed.wordCount;
      if (wc > 0 && wc < VERY_THIN_THRESHOLD) veryThin.push(p.url);
      else if (wc < THIN_THRESHOLD) thin.push(p.url);
    }
    const issues: Issue[] = [];
    if (veryThin.length > 0) {
      issues.push({
        id: "content-very-thin",
        category: "Content Quality",
        priority: "High",
        message: `${veryThin.length} page(s) have fewer than ${VERY_THIN_THRESHOLD} words. Search engines may consider them thin.`,
        urls: veryThin,
      });
    }
    if (thin.length > 0) {
      issues.push({
        id: "content-thin",
        category: "Content Quality",
        priority: "Medium",
        message: `${thin.length} page(s) have fewer than ${THIN_THRESHOLD} words. Consider expanding them.`,
        urls: thin,
      });
    }
    return issues;
  },

  function duplicateBody(index: CrawlIndex): Issue[] {
    // Group pages by SHA-256 of normalized body text.
    const groups = new Map<string, string[]>();
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed) continue;
      const text = p.parsed.text ?? "";
      if (text.length < 200) continue; // skip near-empty bodies
      const hash = createHash("sha256").update(text).digest("hex");
      const arr = groups.get(hash) ?? [];
      arr.push(p.url);
      groups.set(hash, arr);
    }
    const issues: Issue[] = [];
    for (const urls of groups.values()) {
      if (urls.length < 2) continue;
      issues.push({
        id: "content-duplicate-body",
        category: "Content Quality",
        priority: "High",
        message: `${urls.length} page(s) have identical body content. Consolidate or differentiate.`,
        urls,
      });
    }
    return issues;
  },

  function nearDuplicateBody(index: CrawlIndex): Issue[] {
    // Build MinHash signatures, then use lossless threshold banding to avoid
    // comparing every page with every other page.
    const entries: Array<{ url: string; sig: bigint }> = [];
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed) continue;
      const text = p.parsed.text ?? "";
      if (text.length < 500) continue;
      const tokens = shingleTokens(text, 5);
      if (tokens.size < 5) continue;
      entries.push({ url: p.url, sig: minHashSignature(tokens) });
    }

    const parent = entries.map((_, index) => index);
    const componentSize = entries.map(() => 1);
    const verifiedLinks = entries.map(() => 0);
    const minimumSimilarity: Array<number | null> = entries.map(() => null);
    const maximumSimilarity: Array<number | null> = entries.map(() => null);
    const find = (index: number): number => {
      let root = index;
      while (parent[root] !== root) root = parent[root]!;
      while (parent[index] !== index) {
        const next = parent[index]!;
        parent[index] = root;
        index = next;
      }
      return root;
    };
    const union = (left: number, right: number, similarity: number): void => {
      let leftRoot = find(left);
      let rightRoot = find(right);
      if (leftRoot === rightRoot) {
        verifiedLinks[leftRoot] = verifiedLinks[leftRoot]! + 1;
        minimumSimilarity[leftRoot] = Math.min(
          minimumSimilarity[leftRoot] ?? similarity,
          similarity,
        );
        maximumSimilarity[leftRoot] = Math.max(
          maximumSimilarity[leftRoot] ?? similarity,
          similarity,
        );
        return;
      }
      if (componentSize[leftRoot]! < componentSize[rightRoot]!) {
        [leftRoot, rightRoot] = [rightRoot, leftRoot];
      }
      parent[rightRoot] = leftRoot;
      componentSize[leftRoot] =
        componentSize[leftRoot]! + componentSize[rightRoot]!;
      verifiedLinks[leftRoot] =
        verifiedLinks[leftRoot]! + verifiedLinks[rightRoot]! + 1;
      const minimums = [
        minimumSimilarity[leftRoot],
        minimumSimilarity[rightRoot],
        similarity,
      ].filter((value): value is number => value !== null);
      const maximums = [
        maximumSimilarity[leftRoot],
        maximumSimilarity[rightRoot],
        similarity,
      ].filter((value): value is number => value !== null);
      minimumSimilarity[leftRoot] = Math.min(...minimums);
      maximumSimilarity[leftRoot] = Math.max(...maximums);
    };

    // Identical signatures are already guaranteed matches. Collapse them before
    // candidate search so a large exact-duplicate cohort remains linear.
    const representativeBySignature = new Map<bigint, number>();
    const uniqueEntryIndexes: number[] = [];
    for (let index = 0; index < entries.length; index++) {
      const signature = entries[index]!.sig;
      if (signature === 0n) continue;
      const representative = representativeBySignature.get(signature);
      if (representative === undefined) {
        representativeBySignature.set(signature, index);
        uniqueEntryIndexes.push(index);
      } else {
        union(representative, index, 1);
      }
    }

    visitPackedSignaturePairs(
      uniqueEntryIndexes.map((index) => entries[index]!.sig),
      { componentCount: NUM_HASHES, threshold: NEAR_DUP_THRESHOLD },
      ({ left, right, similarity }) => {
        union(
          uniqueEntryIndexes[left]!,
          uniqueEntryIndexes[right]!,
          similarity,
        );
      },
    );

    const groups = new Map<number, number[]>();
    for (let index = 0; index < entries.length; index++) {
      const root = find(index);
      const group = groups.get(root) ?? [];
      group.push(index);
      groups.set(root, group);
    }

    const issues: Issue[] = [];
    for (const [root, group] of groups) {
      if (group.length < 2) continue;
      issues.push({
        id: "content-near-duplicate-body",
        category: "Content Quality",
        priority: "Low",
        message: `${group.length} pages form a near-duplicate body cluster (MinHash >= ${NEAR_DUP_THRESHOLD}). Consider consolidating or differentiating.`,
        urls: group.map((index) => entries[index]!.url),
        detail: {
          threshold: NEAR_DUP_THRESHOLD,
          verifiedLinks: verifiedLinks[root],
          minimumSimilarity: minimumSimilarity[root],
          maximumSimilarity: maximumSimilarity[root],
        },
      });
    }
    return issues;
  },

  function readabilityHard(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    const samples: Array<{ url: string; score: number }> = [];
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed) continue;
      const text = p.parsed.text ?? "";
      if (text.length < 500) continue;
      const score = fleschReadingEase(text);
      if (score === null) continue;
      // < 30 = "very difficult" (college graduate). < 50 = "fairly
      // difficult". For most consumer-facing sites, < 30 is a red flag.
      if (score < 30) {
        urls.push(p.url);
        if (samples.length < 3) samples.push({ url: p.url, score });
      }
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "content-readability-hard",
        category: "Content Quality",
        priority: "Low",
        message: `${urls.length} page(s) score below 30 on Flesch Reading Ease (very hard to read).`,
        urls,
        detail: { samples },
      },
    ];
  },

  function noImages(index: CrawlIndex): Issue[] {
    const urls: string[] = [];
    for (const p of index.pages.values()) {
      if (p.status !== 200 || !p.parsed) continue;
      if (p.parsed.wordCount < THIN_THRESHOLD) continue; // thin pages excluded
      if (p.parsed.images.length === 0) urls.push(p.url);
    }
    if (urls.length === 0) return [];
    return [
      {
        id: "content-no-images",
        category: "Content Quality",
        priority: "Low",
        message: `${urls.length} long page(s) have no images. Consider adding visuals to improve engagement.`,
        urls,
      },
    ];
  },
];
