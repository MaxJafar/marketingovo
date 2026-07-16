// keyword_research: the strong keyword-research module.
//
// Composes three layers of real, free, non-API-key data:
//
//   1. suggestAll() — autocomplete from 5 sources (google,
//      youtube, bing, amazon, wikipedia). The "long-tail surface".
//   2. classifyIntent() — heuristic intent labelling
//      (informational / transactional / navigational / commercial).
//   3. trendsInterest() (existing integrations:trends) —
//      momentum signal ("growing" / "steady" / "declining").
//
// Output: a single KeywordProfile that ranks the discovered
// terms, classifies intent for the seed + top variants, and
// gives an action recommendation (write / monitor / skip) with
// a 0..100 strength score.
//
// Depends on: nothing (each source is independently
// best-effort). Composes with audit-full because the module
// can be slotted into a multi-module run as
// "integrations:keyword-research".

import { ConsoleLogger } from "../../core/logger.js";
import {
  suggestAll,
  isAvailable as suggestAvailable,
  dedupeAndRank,
  type SuggestHit,
  type SuggestSource,
  type SuggestResult,
} from "../../integrations/suggest.js";
import {
  classifyIntent,
  type Intent,
  type IntentResult,
} from "../../integrations/intent.js";
import {
  trendsInterest,
  isAvailable as trendsAvailable,
  type TrendsReport,
} from "../../integrations/trends.js";
import {
  paaAll,
  paaBest,
  isAvailable as paaAvailable,
  type PaaResult,
  type PaaBackend,
  type ResearchProviderCredentials,
} from "../../integrations/paa.js";
import {
  relatedAll,
  relatedBest,
  isAvailable as relatedAvailable,
  type RelatedSearchResult,
  type RelatedBackend,
} from "../../integrations/related-searches.js";
import type {
  Module,
  ModuleContext,
  ModuleInput,
  ModuleOutput,
  ModuleSelfTestResult,
} from "../types.js";

export interface KeywordProfile {
  seed: string;
  intent: IntentResult;
  /** All suggestion hits, deduped and ranked. */
  suggestions: SuggestHit[];
  /** Optional momentum from Google Trends; null if trends isn't available. */
  momentum: TrendsReport | null;
  /** PAA questions from all available backends. Null if disabled. */
  paa: PaaResult[] | null;
  /** Related searches from all available backends. Null if disabled. */
  relatedSearches: RelatedSearchResult[] | null;
  /** Known and unknown provider usage; missing cost is never displayed as zero. */
  providerUsage: {
    actualCostUsd: number;
    billableRequests: number;
    unreportedBillableRequests: number;
    freeRequests: number;
  };
  /** Top variants with their own intent classification. */
  variants: Array<{ term: string; sourceCount: number; intent: IntentResult }>;
  /** 0..100 score combining variant breadth, intent, and trends momentum. */
  strength: number;
  /** Concrete next-step advice based on the profile. */
  recommendation: "write" | "monitor" | "skip";
  /** Human-readable one-paragraph summary. */
  summary: string;
  /** Per-source diagnostic data. */
  sources: SuggestResult[];
}

export const keywordResearchModule: Module = {
  id: "integrations:keyword-research",
  version: "0.11.0",
  displayName: "Keyword Research",
  category: "research",
  description:
    "Evidence-first keyword research across five suggestion sources, People Also Ask, Related Searches, intent, and Trends. Returns a ranked KeywordProfile with transparent provider usage, reported cost, source failures, and write/monitor/skip guidance. Paid credentials come only from the local vault.",
  inputSchema: {
    type: "object",
    properties: {
      seed: {
        type: "string",
        description: "Seed keyword to expand. Required.",
      },
      sources: {
        type: "array",
        items: {
          type: "string",
          enum: ["google", "youtube", "bing", "amazon", "wikipedia"],
        },
        default: ["google", "youtube", "bing", "amazon", "wikipedia"],
        description: "Which suggestion sources to query. Default: all five.",
      },
      topVariants: {
        type: "number",
        default: 10,
        description:
          "How many of the top-ranked variants to classify intent for. Default 10.",
      },
      includeTrends: {
        type: "boolean",
        default: true,
        description:
          "Fetch Google Trends momentum for the seed. Default true. Skipped silently if the google-trends-api package isn't installed.",
      },
      includePaa: {
        type: "boolean",
        default: true,
        description:
          "Fetch People Also Ask questions for the seed via the configured backends (SerpApi / DataForSEO / custom scraper). Default true. The custom scraper always runs as fallback; paid provider credentials are loaded from the local vault.",
      },
      includeRelated: {
        type: "boolean",
        default: true,
        description:
          "Fetch Related Searches for the seed via the configured backends (SerpApi / DataForSEO / custom scraper). Default true. Paid provider credentials are loaded from the local vault.",
      },
      paaBackends: {
        type: "array",
        items: { type: "string", enum: ["serpapi", "dataforseo", "custom"] },
        default: ["serpapi", "dataforseo", "custom"],
        description:
          "Which PAA backends to try, in priority order. Default: all three. Skips any whose credentials aren't set.",
      },
      relatedBackends: {
        type: "array",
        items: { type: "string", enum: ["serpapi", "dataforseo", "custom"] },
        default: ["serpapi", "dataforseo", "custom"],
        description:
          "Which Related-Searches backends to try, in priority order. Default: all three.",
      },
    },
    required: ["seed"],
  },
  outputSchema: {
    type: "object",
    properties: {
      profile: {
        type: "object",
        description: "KeywordProfile (see module source for shape).",
      },
      issues: {
        type: "array",
        description:
          "Recommendation-derived issues. Empty if the seed is strong; one 'info' issue if the recommendation is 'skip'.",
      },
    },
  },
  dependsOn: [],
  configKeys: [],
  async invoke(input: ModuleInput, ctx: ModuleContext): Promise<ModuleOutput> {
    const logger = (ctx.logger ?? new ConsoleLogger()).child({
      module: "keyword-research",
    });
    if (!suggestAvailable()) {
      throw new Error("global fetch() not available (Node < 18)");
    }
    const seed = (input.seed as string | undefined)?.trim();
    if (!seed)
      throw new Error("keyword-research requires a non-empty 'seed' in input");

    const sources =
      (input.sources as readonly SuggestSource[] | undefined) ?? [];
    const topVariants = Math.max(
      1,
      Math.min(50, (input.topVariants as number | undefined) ?? 10),
    );
    const includeTrends = (input.includeTrends as boolean | undefined) ?? true;
    const includePaa = (input.includePaa as boolean | undefined) ?? true;
    const includeRelated =
      (input.includeRelated as boolean | undefined) ?? true;
    const paaBackends =
      (input.paaBackends as readonly PaaBackend[] | undefined) ?? [];
    const relatedBackends =
      (input.relatedBackends as readonly RelatedBackend[] | undefined) ?? [];
    const providerCredentials = ctx.integrationCredentials as
      ResearchProviderCredentials | undefined;
    const providerFetch = ctx.providerFetch;

    const seedIntent = classifyIntent(seed);

    // Fire all 3 layers in parallel: suggest + paa + related. Trends
    // joins the parallel fan-out too; it has the longest tail and
    // benefits from the overlap.
    const paaPromise =
      includePaa && paaAvailable()
        ? paaAll(seed, {
            backends: paaBackends.length > 0 ? paaBackends : undefined,
            credentials: providerCredentials,
            ...(providerFetch ? { fetchImpl: providerFetch } : {}),
          })
        : Promise.resolve<PaaResult[] | null>(null);
    const relatedPromise =
      includeRelated && relatedAvailable()
        ? relatedAll(seed, {
            backends: relatedBackends.length > 0 ? relatedBackends : undefined,
            credentials: providerCredentials,
            ...(providerFetch ? { fetchImpl: providerFetch } : {}),
          })
        : Promise.resolve<RelatedSearchResult[] | null>(null);
    const trendsPromise =
      includeTrends && trendsAvailable()
        ? trendsInterest({ keyword: seed, days: 90 }).catch((err: Error) => {
            logger.warn("trends fetch failed (continuing without momentum)", {
              err: err.message,
            });
            return null;
          })
        : Promise.resolve<TrendsReport | null>(null);
    if (includeTrends && !trendsAvailable()) {
      logger.info("trends module not available — skipping momentum");
    }

    const [sourcesResult, paaResults, relatedResults, momentum] =
      await Promise.all([
        suggestAll(seed, { sources: sources.length > 0 ? sources : undefined }),
        paaPromise,
        relatedPromise,
        trendsPromise,
      ]);

    const ranked = dedupeAndRank(sourcesResult.flatMap((s) => s.hits));
    const variants = ranked.slice(0, topVariants).map((hit) => ({
      term: hit.term,
      sourceCount: countSourceOccurrences(ranked, hit.term),
      intent: classifyIntent(hit.term),
    }));

    const profile = buildProfile(
      seed,
      seedIntent,
      ranked,
      variants,
      momentum,
      sourcesResult,
      paaResults,
      relatedResults,
    );
    const issues = issuesFromProfile(profile);
    if (issues.length === 0) {
      ctx.signal.markStrong(
        `keyword-research: ${ranked.length} suggestions, intent=${profile.intent.intent}, strength=${profile.strength}`,
      );
    } else {
      ctx.signal.markWeak(
        `keyword-research: ${issues.length} issues, recommendation=${profile.recommendation}`,
      );
    }
    logger.info("keyword-research complete", {
      seed,
      suggestionCount: ranked.length,
      paaCount: (paaResults ?? []).reduce((n, r) => n + r.items.length, 0),
      relatedCount: (relatedResults ?? []).reduce(
        (n, r) => n + r.items.length,
        0,
      ),
      strength: profile.strength,
      recommendation: profile.recommendation,
    });
    return { profile, issues } as unknown as ModuleOutput;
  },
  async selfTest(): Promise<ModuleSelfTestResult> {
    if (!suggestAvailable()) {
      return {
        ok: false,
        issues: ["global fetch() not available (Node < 18)"],
        checkedAt: new Date().toISOString(),
      };
    }
    return { ok: true, issues: [], checkedAt: new Date().toISOString() };
  },
};

// Re-export the PAA / Related-Searches best-pickers so callers
// who only want one layer (e.g. the topic-clusters module) don't
// have to import the integration files directly.
export {
  paaBest,
  paaAll,
  type PaaResult,
  type PaaBackend,
} from "../../integrations/paa.js";
export {
  relatedBest,
  relatedAll,
  type RelatedSearchResult,
  type RelatedBackend,
} from "../../integrations/related-searches.js";

function countSourceOccurrences(
  all: readonly SuggestHit[],
  term: string,
): number {
  const lc = term.trim().toLowerCase();
  return all.filter((h) => h.term.trim().toLowerCase() === lc).length;
}

/**
 * Build a KeywordProfile from raw inputs. Exported for unit
 * testing — invoke() is just a wrapper around this.
 */
export function buildProfile(
  seed: string,
  seedIntent: IntentResult,
  ranked: readonly SuggestHit[],
  variants: Array<{ term: string; sourceCount: number; intent: IntentResult }>,
  momentum: TrendsReport | null,
  sources: readonly SuggestResult[],
  paa: PaaResult[] | null = null,
  related: RelatedSearchResult[] | null = null,
): KeywordProfile {
  // Strength 0..100. Six components, each capped:
  //   - variant breadth:        min(ranked.length, 30) * 1 → 0..30
  //   - source coverage:        unique successful suggest sources (0..5) * 4 → 0..20
  //   - intent clarity:         top intent confidence (0..1) * 15 → 0..15
  //   - question / long-tail:   +5 if seed is a question, +5 if any variant is a question
  //   - paa depth (NEW):        min(unique-paa-questions, 12) * 1 → 0..12
  //                             a non-empty PAA means Google surfaces this
  //                             as a real user question — strong content signal.
  //   - related searches (NEW): min(unique-related-terms, 8) * 1 → 0..8
  //                             a non-empty Related block means Google
  //                             is routing searchers to related queries
  //                             — validates the topic.
  //   - trends momentum:        -10 if declining, +10 if growing, 0 otherwise
  //
  // The combined ceiling is 30+20+15+10+12+8+10 = 105, clamped to 100.
  // We keep the per-component math in plain integers so the score
  // is easy to explain in issue reports.
  const variantScore = Math.min(ranked.length, 30);
  const successfulSources = new Set(
    sources.filter((s) => s.hits.length > 0).map((s) => s.source),
  );
  const sourceScore = successfulSources.size * 4;
  const intentScore = seedIntent.confidence * 15;
  const questionScore =
    (seedIntent.isQuestion ? 5 : 0) +
    (variants.some((v) => v.intent.isQuestion) ? 5 : 0);

  const paaItems = paa ? uniqueStrings(paa.flatMap((r) => r.items)) : [];
  const paaScore = Math.min(paaItems.length, 12);

  const relatedItems = related
    ? uniqueStrings(related.flatMap((r) => r.items))
    : [];
  const relatedScore = Math.min(relatedItems.length, 8);

  let momentumScore = 0;
  if (momentum) {
    if (momentum.verdict === "growing") momentumScore = 10;
    else if (momentum.verdict === "declining") momentumScore = -10;
  }
  const strength = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        variantScore +
          sourceScore +
          intentScore +
          questionScore +
          paaScore +
          relatedScore +
          momentumScore,
      ),
    ),
  );

  let recommendation: KeywordProfile["recommendation"] = "monitor";
  if (strength >= 50) recommendation = "write";
  else if (strength < 25) recommendation = "skip";

  // Concise summary.
  const parts: string[] = [];
  parts.push(
    `Seed "${seed}" is ${seedIntent.intent} (confidence ${(seedIntent.confidence * 100).toFixed(0)}%).`,
  );
  parts.push(
    `Got ${ranked.length} suggestions from ${successfulSources.size}/${sources.length} sources.`,
  );
  if (variants.length > 0) {
    const qs = variants.filter((v) => v.intent.isQuestion).length;
    if (qs > 0)
      parts.push(`${qs} of the top ${variants.length} variants are questions.`);
  }
  if (paaItems.length > 0) {
    parts.push(`PAA: ${paaItems.length} unique questions.`);
  }
  if (relatedItems.length > 0) {
    parts.push(`Related: ${relatedItems.length} unique searches.`);
  }
  const usage = [...(paa ?? []), ...(related ?? [])]
    .map((result) => result.usage)
    .filter((entry): entry is NonNullable<typeof entry> =>
      Boolean(entry?.requestMade),
    );
  const providerUsage = {
    actualCostUsd: usage.reduce(
      (sum, entry) => sum + (entry.actualCostUsd ?? 0),
      0,
    ),
    billableRequests: usage.filter((entry) => entry.billable).length,
    unreportedBillableRequests: usage.filter(
      (entry) => entry.billable && entry.actualCostUsd === null,
    ).length,
    freeRequests: usage.filter((entry) => !entry.billable).length,
  };
  if (providerUsage.billableRequests > 0) {
    const unknown = providerUsage.unreportedBillableRequests;
    parts.push(
      `Provider usage: $${providerUsage.actualCostUsd.toFixed(4)} reported${unknown > 0 ? `; ${unknown} billable request(s) did not report a per-call cost` : ""}.`,
    );
  }
  if (momentum) {
    parts.push(
      `Trends: ${momentum.verdict} (momentum=${momentum.momentum.toFixed(1)}, slope=${momentum.slope.toFixed(2)}/mo).`,
    );
  }
  parts.push(`Strength ${strength}/100 → ${recommendation.toUpperCase()}.`);

  return {
    seed,
    intent: seedIntent,
    suggestions: [...ranked],
    momentum,
    paa: paa ? [...paa] : null,
    relatedSearches: related ? [...related] : null,
    providerUsage,
    variants,
    strength,
    recommendation,
    summary: parts.join(" "),
    sources: [...sources],
  };
}

function uniqueStrings(arr: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of arr) {
    const key = t.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function issuesFromProfile(
  p: KeywordProfile,
): Array<{ severity: "info" | "warning"; message: string }> {
  const issues: Array<{ severity: "info" | "warning"; message: string }> = [];
  if (p.recommendation === "skip") {
    issues.push({
      severity: "info",
      message: `Keyword "${p.seed}" scored ${p.strength}/100. Recommendation: skip — only ${p.suggestions.length} variants, intent unclear or no momentum.`,
    });
  }
  if (p.sources.every((s) => s.error)) {
    issues.push({
      severity: "warning",
      message: `All 5 suggestion sources failed. Check network egress. Last error: ${p.sources.find((s) => s.error)?.error ?? "unknown"}`,
    });
  }
  // If PAA was requested and all backends failed (e.g. the
  // operator is sandboxed and Google returns a captcha), warn
  // — but don't fail the whole run.
  if (
    p.paa &&
    p.paa.length > 0 &&
    p.paa.every((r) => r.items.length === 0 && !r.requiresKey)
  ) {
    const lastError = p.paa.find((r) => r.error)?.error ?? "unknown";
    issues.push({
      severity: "info",
      message: `PAA: all ${p.paa.length} configured backends returned 0 questions. Last error: ${lastError}. Connect SerpAPI or DataForSEO for a paid fallback.`,
    });
  }
  if (
    p.relatedSearches &&
    p.relatedSearches.length > 0 &&
    p.relatedSearches.every((r) => r.items.length === 0 && !r.requiresKey)
  ) {
    const lastError =
      p.relatedSearches.find((r) => r.error)?.error ?? "unknown";
    issues.push({
      severity: "info",
      message: `Related: all ${p.relatedSearches.length} configured backends returned 0 searches. Last error: ${lastError}.`,
    });
  }
  return issues;
}
