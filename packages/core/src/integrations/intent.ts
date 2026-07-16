// Keyword intent classification. Lightweight heuristic — no LLM,
// no embeddings. The output is a label + a 0..1 confidence for
// each label.
//
// The four classic search intents:
//   - informational:  the user wants to learn ("how does X work")
//   - transactional:  the user wants to buy ("buy X", "X price")
//   - navigational:   the user wants to find a specific site
//                     ("facebook login", "gmail")
//   - commercial:     the user is comparing options before a
//                     future purchase ("best X 2026", "X vs Y")
//
// We tokenise, normalise, and apply pattern lists. A keyword can
// match multiple intents — we keep the top one and a confidence
// for the next-most-likely as a sanity check.

export type Intent =
  "informational" | "transactional" | "navigational" | "commercial";

export interface IntentResult {
  intent: Intent;
  /** 0..1. The share of intent signals that pointed at the top label. */
  confidence: number;
  /** 0..1 per label, summing to ~1.0 across the four. */
  scores: Record<Intent, number>;
  /** True if the term is shaped like a question (5W1H or auxiliary verb). */
  isQuestion: boolean;
  /** Number of words in the term (after stopword removal). */
  wordCount: number;
}

const QUESTION_STARTERS = new Set([
  "how",
  "what",
  "why",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "whose",
]);

const TRANSACTIONAL_PATTERNS: RegExp[] = [
  /\bbuy\b/,
  /\bprice\b/,
  /\bprices\b/,
  /\border\b/,
  /\bshop\b/,
  /\bdiscount\b/,
  /\bcoupon\b/,
  /\bdeals?\b/,
  /\bsale\b/,
  /\bcheap\b/,
  /\bcheapest\b/,
  /\baffordable\b/,
  /\bpurchase\b/,
  /\bshipping\b/,
  /\bdelivery\b/,
];

const COMMERCIAL_PATTERNS: RegExp[] = [
  /\bbest\b/,
  /\btop\b/,
  /\breview\b/,
  /\breviews\b/,
  /\bvs\.?\b/,
  /\bversus\b/,
  /\bcompare\b/,
  /\bcomparison\b/,
  /\balternative\b/,
  /\balternatives\b/,
  /\bcompared\b/,
];

const NAVIGATIONAL_PATTERNS: RegExp[] = [
  /^login$/,
  /^log ?in$/,
  /^sign ?in$/,
  /^signup$/,
  /^sign ?up$/,
  /^official\b/,
  /^homepage$/,
  /^home page$/,
  /\bofficial site$/,
  /^[a-z]+\.com$/,
];

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "were",
  "will",
  "with",
  "you",
  "your",
]);

export function tokenise(term: string): string[] {
  return term
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

export function classifyIntent(term: string): IntentResult {
  const tokens = tokenise(term);
  const contentTokens = tokens.filter((t) => !STOPWORDS.has(t));
  const wordCount = contentTokens.length;
  const firstToken = tokens[0] ?? "";
  const lc = term.toLowerCase().trim();

  // 1. Informational: starts with a question word, or has a
  //    question mark, or has 4+ words and no transactional/commercial
  //    markers (long-tail informational queries).
  let informational = 0;
  if (lc.endsWith("?")) informational += 0.8;
  if (QUESTION_STARTERS.has(firstToken)) informational += 0.7;
  if (wordCount >= 4) informational += 0.2;
  if (/\b(can|does|do|should|is|are|will|would|could|may|might)\b/.test(lc))
    informational += 0.3;

  // 2. Transactional: explicit buy / price / order patterns.
  let transactional = 0;
  for (const p of TRANSACTIONAL_PATTERNS) {
    if (p.test(lc)) transactional += 0.6;
  }
  if (wordCount >= 2 && wordCount <= 4) transactional += 0.1; // typical buyer queries are short

  // 3. Commercial: comparison / review patterns.
  let commercial = 0;
  for (const p of COMMERCIAL_PATTERNS) {
    if (p.test(lc)) commercial += 0.6;
  }

  // 4. Navigational: short, brand-shaped, "login" patterns.
  let navigational = 0;
  for (const p of NAVIGATIONAL_PATTERNS) {
    if (p.test(lc)) navigational += 0.8;
  }
  if (
    wordCount <= 2 &&
    navigational === 0 &&
    !QUESTION_STARTERS.has(firstToken) &&
    transactional === 0 &&
    commercial === 0
  ) {
    // Short queries with no other markers are often navigational
    // (the user knows what they want). Push a small base rate.
    navigational += 0.3;
  }

  // Normalise into 0..1 scores that sum to ~1.0.
  const raw = { informational, transactional, commercial, navigational };
  const total =
    raw.informational + raw.transactional + raw.commercial + raw.navigational;
  const scores: Record<Intent, number> = {
    informational: 0,
    transactional: 0,
    commercial: 0,
    navigational: 0,
  };
  if (total > 0) {
    for (const k of Object.keys(scores) as Intent[]) scores[k] = raw[k] / total;
  } else {
    // No signals at all — default to informational (most common).
    scores.informational = 0.6;
    scores.commercial = 0.2;
    scores.transactional = 0.1;
    scores.navigational = 0.1;
  }

  // Top label.
  let topLabel: Intent = "informational";
  let topScore = 0;
  for (const k of Object.keys(scores) as Intent[]) {
    if (scores[k] > topScore) {
      topLabel = k;
      topScore = scores[k];
    }
  }

  return {
    intent: topLabel,
    confidence: topScore,
    scores,
    isQuestion: lc.endsWith("?") || QUESTION_STARTERS.has(firstToken),
    wordCount,
  };
}
