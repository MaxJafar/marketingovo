// Content-gap analysis. Given a target document and N reference
// documents, find terms that the references cover well but the
// target misses.
//
// We use plain TF-IDF (not LSA, not embeddings). It's fast, the
// output is interpretable ("the term 'render-blocking' appears in
// 2 of your reference pages and 0 times in your target"), and the
// user can read the score. Embeddings would give slightly better
// coverage on synonyms but make the score opaque.
//
// "Missing" = term's density in target is < 30% of average density
// in references, AND the term appears in >= `minRefFreq` of the
// references. This is a heuristic; the user is expected to apply
// judgement.

import type { ExtractedContent } from "./content-extract.js";

export interface DocVector {
  /** Term -> count in this doc. */
  tf: Map<string, number>;
  /** Total tokens (after stopwords). */
  total: number;
}

export interface GapTerm {
  term: string;
  /** How many of the reference docs contain this term. */
  refFreq: number;
  /** Average density in references (count / total terms). */
  refDensity: number;
  /** Density in target (count / total terms), 0 if absent. */
  targetDensity: number;
  /**
   * Score = refFreq × (refDensity - targetDensity), scaled by 1000
   * for readability. Higher = more clearly "missing".
   */
  score: number;
  /** A short excerpt from one of the reference docs where the term appears. */
  excerpt: string;
}

export interface ContentGapReport {
  targetUrl: string;
  referenceUrls: string[];
  targetWordCount: number;
  referenceWordCounts: number[];
  /** Top-N missing terms, sorted by score desc. */
  missing: GapTerm[];
  /** Per-reference coverage: how many of the candidate terms each ref has. */
  perReference: Array<{
    url: string;
    matchedTermCount: number;
    totalCandidateTerms: number;
  }>;
  /** Populated on partial failure. */
  errors: string[];
}

export interface GapOptions {
  /** How many top terms to return. Default 20. */
  topN?: number;
  /** Minimum fraction of references that must contain the term. Default 0.5. */
  minRefRatio?: number;
  /**
   * How aggressive the "missing" threshold is. A term is "missing" if
   * targetDensity < ratio × refDensity. Default 0.3 (target has
   * <30% of the average reference density).
   */
  missingRatio?: number;
  /**
   * Ignore the top K most-frequent terms in the corpus. They tend
   * to be topic-generic ("article", "guide") and dominate the
   * candidate list. Default 50.
   */
  ignoreTopCorpus?: number;
}

const DEFAULTS: Required<GapOptions> = {
  topN: 20,
  minRefRatio: 0.5,
  missingRatio: 0.3,
  ignoreTopCorpus: 50,
};

export function buildVector(doc: ExtractedContent): DocVector {
  const tf = new Map<string, number>();
  for (const w of doc.words) {
    tf.set(w, (tf.get(w) ?? 0) + 1);
  }
  return { tf, total: doc.words.length };
}

export function computeContentGap(
  target: { url: string; doc: ExtractedContent; vector: DocVector },
  references: Array<{ url: string; doc: ExtractedContent; vector: DocVector }>,
  options: GapOptions = {},
): ContentGapReport {
  const opts = { ...DEFAULTS, ...options };
  const errors: string[] = [];
  if (references.length === 0) {
    errors.push("no reference documents provided");
    return emptyReport(target, references, errors);
  }
  // Build document frequency (df) across the references. df[term] =
  // number of refs that contain it at least once.
  const df = new Map<string, number>();
  for (const ref of references) {
    for (const term of ref.vector.tf.keys()) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  // Filter by minRefRatio first.
  const minRefCount = Math.max(
    1,
    Math.ceil(references.length * opts.minRefRatio),
  );
  const candidates: string[] = [];
  for (const [term, count] of df) {
    if (count >= minRefCount) candidates.push(term);
  }
  // Drop the top-K most corpus-frequent terms. These tend to be
  // topic-generic and add noise to the candidate list.
  if (opts.ignoreTopCorpus > 0 && candidates.length > opts.ignoreTopCorpus) {
    const sorted = [...candidates].sort(
      (a, b) => (df.get(b) ?? 0) - (df.get(a) ?? 0),
    );
    const ignored = new Set(sorted.slice(0, opts.ignoreTopCorpus));
    const filtered: string[] = [];
    for (const t of candidates) {
      if (!ignored.has(t)) filtered.push(t);
    }
    candidates.length = 0;
    candidates.push(...filtered);
  }
  // For each candidate, compute densities + score.
  const missing: GapTerm[] = [];
  for (const term of candidates) {
    const refDensities: number[] = [];
    let refCount = 0;
    let firstExcerpt = "";
    for (const ref of references) {
      const c = ref.vector.tf.get(term) ?? 0;
      if (c > 0) {
        refCount += 1;
        refDensities.push(c / Math.max(1, ref.vector.total));
        if (!firstExcerpt) firstExcerpt = excerptAround(ref.doc.text, term);
      }
    }
    const refDensity = avg(refDensities);
    const targetCount = target.vector.tf.get(term) ?? 0;
    const targetDensity = targetCount / Math.max(1, target.vector.total);
    if (targetDensity >= refDensity * opts.missingRatio) continue; // not "missing"
    const score = refCount * (refDensity - targetDensity) * 1000;
    missing.push({
      term,
      refFreq: refCount,
      refDensity,
      targetDensity,
      score,
      excerpt: firstExcerpt,
    });
  }
  missing.sort((a, b) => b.score - a.score);
  const top = missing.slice(0, opts.topN);
  // Per-reference coverage of the top-N candidate set.
  const candidateSet = new Set(top.map((m) => m.term));
  const perReference = references.map((ref) => {
    let matched = 0;
    for (const t of candidateSet) {
      if ((ref.vector.tf.get(t) ?? 0) > 0) matched += 1;
    }
    return {
      url: ref.url,
      matchedTermCount: matched,
      totalCandidateTerms: candidateSet.size,
    };
  });
  return {
    targetUrl: target.url,
    referenceUrls: references.map((r) => r.url),
    targetWordCount: target.vector.total,
    referenceWordCounts: references.map((r) => r.vector.total),
    missing: top,
    perReference,
    errors,
  };
}

function emptyReport(
  target: { url: string; doc: ExtractedContent; vector: DocVector },
  references: Array<{ url: string; doc: ExtractedContent; vector: DocVector }>,
  errors: string[],
): ContentGapReport {
  return {
    targetUrl: target.url,
    referenceUrls: references.map((r) => r.url),
    targetWordCount: target.vector.total,
    referenceWordCounts: references.map((r) => r.vector.total),
    missing: [],
    perReference: references.map((r) => ({
      url: r.url,
      matchedTermCount: 0,
      totalCandidateTerms: 0,
    })),
    errors,
  };
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function excerptAround(text: string, term: string, radius = 80): string {
  const lower = text.toLowerCase();
  const i = lower.indexOf(term);
  if (i < 0) return "";
  const start = Math.max(0, i - radius);
  const end = Math.min(text.length, i + term.length + radius);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";
  return snippet;
}
