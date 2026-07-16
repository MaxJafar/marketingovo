// topic_clusters: build topical pillar-and-spoke maps from a
// list of seed terms. The "what should I write about next?"
// module.
//
// Workflow:
//   1. Caller provides a list of seed terms (e.g. extracted
//      from existing site content, or pasted by hand).
//   2. For each seed, we fetch autocomplete suggestions from
//      all 5 sources (google/youtube/bing/amazon/wikipedia)
//      via the suggest client. This is the same machinery
//      keyword-research uses — no separate API key, no
//      duplicate code.
//   3. We cluster the seeds by suggestion-overlap (Jaccard
//      similarity via Union-Find). Each connected component
//      is a "cluster".
//   4. For each cluster, we pick a hub (highest overlap with
//      the rest) and spokes (hub's suggestions not covered by
//      other members). The result is a publishable pillar-and-
//      spoke plan.
//
// Output: { clusters: TopicCluster[], seedCount, clusterCount,
// unclusteredCount, summary }.
//
// Depends on: nothing (each layer is independent). Composes
// with audit-full because the module can be added to a
// composer run as "integrations:topic-clusters".

import { ConsoleLogger } from "../../core/logger.js";
import {
  suggestAll,
  isAvailable as suggestAvailable,
  dedupeAndRank,
  type SuggestSource,
  type SuggestResult,
} from "../../integrations/suggest.js";
import {
  cluster,
  type TopicCluster,
  type SeedSuggestions,
  type ClusterOptions,
} from "../../integrations/cluster.js";
import type {
  Module,
  ModuleContext,
  ModuleInput,
  ModuleOutput,
  ModuleSelfTestResult,
} from "../types.js";

export interface TopicClustersProfile {
  seedCount: number;
  clusterCount: number;
  unclustered: string[];
  clusters: TopicCluster[];
  /** Per-source diagnostic data (so operators can see which
   *  sources actually contributed suggestions). */
  sources: SuggestResult[][];
  /** One-paragraph human summary. */
  summary: string;
}

export const topicClustersModule: Module = {
  id: "integrations:topic-clusters",
  version: "0.9.0",
  displayName: "Topic Clusters",
  category: "research",
  description:
    "Build topical pillar-and-spoke maps from a list of seed terms. For each seed, fetches autocomplete suggestions from 5 sources (google/youtube/bing/amazon/wikipedia) and clusters the seeds by suggestion overlap (Jaccard similarity). Each cluster is a pillar; the hub is the seed with the highest overlap with the rest; spokes are the hub's suggestions not yet covered by other members. Use it to plan content calendars, group related articles, and identify topical authority gaps.",
  inputSchema: {
    type: "object",
    properties: {
      seeds: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        description:
          "Seed terms (e.g. topics the operator wants to rank for). Required. Minimum 1 entry.",
      },
      sources: {
        type: "array",
        items: {
          type: "string",
          enum: ["google", "youtube", "bing", "amazon", "wikipedia"],
        },
        default: ["google", "youtube", "bing", "amazon", "wikipedia"],
        description: "Which autocomplete sources to query. Default: all five.",
      },
      suggestionsPerSeed: {
        type: "number",
        default: 15,
        description:
          "How many of the top suggestions to keep per seed (caps the suggestion pool). Default 15.",
      },
      minSimilarity: {
        type: "number",
        default: 0.3,
        description:
          "Jaccard-similarity threshold for linking two seeds. Default 0.3. Higher → tighter clusters.",
      },
      maxSpokes: {
        type: "number",
        default: 8,
        description: "Maximum spokes per cluster. Default 8.",
      },
    },
    required: ["seeds"],
  },
  outputSchema: {
    type: "object",
    properties: {
      profile: {
        type: "object",
        description:
          "TopicClustersProfile (clusters, summary, source diagnostics).",
      },
      issues: {
        type: "array",
        description:
          "Operator-facing issues: e.g. 'all 5 sources failed' or 'no seeds given'.",
      },
    },
  },
  dependsOn: [],
  configKeys: [],
  async invoke(input: ModuleInput, ctx: ModuleContext): Promise<ModuleOutput> {
    const logger = (ctx.logger ?? new ConsoleLogger()).child({
      module: "topic-clusters",
    });
    if (!suggestAvailable()) {
      throw new Error("global fetch() not available (Node < 18)");
    }
    const seedsRaw = (input.seeds as string[] | undefined) ?? [];
    const seeds = seedsRaw.map((s) => s.trim()).filter((s) => s.length > 0);
    if (seeds.length === 0) {
      throw new Error("topic-clusters requires a non-empty 'seeds' array");
    }
    if (new Set(seeds.map((s) => s.toLowerCase())).size !== seeds.length) {
      throw new Error(
        "topic-clusters: duplicate seed (case-insensitive) detected",
      );
    }
    const sources =
      (input.sources as readonly SuggestSource[] | undefined) ?? [];
    const suggestionsPerSeed = Math.max(
      1,
      Math.min(50, (input.suggestionsPerSeed as number | undefined) ?? 15),
    );
    const minSimilarity = clamp01(
      (input.minSimilarity as number | undefined) ?? 0.3,
      0,
      1,
    );
    const maxSpokes = Math.max(
      1,
      Math.min(50, (input.maxSpokes as number | undefined) ?? 8),
    );

    // 1. Fetch suggestions for every seed in parallel.
    const perSeed = await Promise.all(
      seeds.map(async (seed) => {
        const sourcesResult = await suggestAll(seed, {
          sources: sources.length > 0 ? sources : undefined,
        });
        const ranked = dedupeAndRank(sourcesResult.flatMap((s) => s.hits));
        const top = ranked.slice(0, suggestionsPerSeed).map((h) => h.term);
        return { seed, sourcesResult, top };
      }),
    );

    // 2. Cluster.
    const inputs: SeedSuggestions[] = perSeed.map((p) => ({
      seed: p.seed,
      suggestions: p.top,
    }));
    const clusterOpts: ClusterOptions = { minSimilarity, maxSpokes };
    const clusters = cluster(inputs, clusterOpts);

    // 3. Identify "unclustered" seeds: a single-member cluster
    //    whose member has no overlap with anything else AND
    //    has a small suggestion pool. Those are the truly
    //    niche / orphan topics.
    const allMembers = new Set<string>();
    for (const c of clusters) for (const m of c.members) allMembers.add(m);
    const unclustered: string[] = [];
    for (const c of clusters) {
      if (c.members.length === 1) {
        const seed = c.members[0]!;
        const isSolo =
          clusters.filter(
            (cc) => cc.members.length > 1 && cc.members.includes(seed),
          ).length === 0;
        if (isSolo && c.suggestionPoolSize < 3) unclustered.push(seed);
      }
    }

    const profile: TopicClustersProfile = {
      seedCount: seeds.length,
      clusterCount: clusters.filter((c) => c.members.length > 1).length,
      unclustered,
      clusters,
      sources: perSeed.map((p) => p.sourcesResult),
      summary: buildSummary(clusters, unclustered, seeds.length),
    };

    const issues = issuesFromProfile(profile);
    if (issues.length === 0) {
      ctx.signal.markStrong(
        `topic-clusters: ${profile.clusterCount} cluster(s) from ${profile.seedCount} seeds`,
      );
    } else {
      ctx.signal.markWeak(
        `topic-clusters: ${issues.length} issue(s), ${profile.clusterCount} cluster(s)`,
      );
    }
    logger.info("topic-clusters complete", {
      seedCount: profile.seedCount,
      clusterCount: profile.clusterCount,
      unclustered: unclustered.length,
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

function clamp01(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function buildSummary(
  clusters: readonly TopicCluster[],
  unclustered: readonly string[],
  totalSeeds: number,
): string {
  const main = clusters.filter((c) => c.members.length > 1);
  if (main.length === 0) {
    return `${totalSeeds} seed(s), no overlapping clusters. Try more seeds or lower minSimilarity.`;
  }
  const heads = main
    .slice(0, 3)
    .map(
      (c) =>
        `"${c.hub}" (${c.members.length} members, cohesion ${c.cohesion.toFixed(2)})`,
    )
    .join(", ");
  const tail = main.length > 3 ? `, +${main.length - 3} more` : "";
  const orphan =
    unclustered.length > 0 ? ` ${unclustered.length} orphan seed(s).` : "";
  return `${totalSeeds} seeds → ${main.length} cluster(s): ${heads}${tail}.${orphan}`;
}

function issuesFromProfile(
  p: TopicClustersProfile,
): Array<{ severity: "info" | "warning"; message: string }> {
  const issues: Array<{ severity: "info" | "warning"; message: string }> = [];
  if (p.unclustered.length > 0 && p.unclustered.length === p.seedCount) {
    issues.push({
      severity: "warning",
      message: `No overlapping clusters formed. Lower minSimilarity or add more seeds.`,
    });
  }
  // All sources failed across all seeds → network problem.
  const allSourcesFailed = p.sources.every((seeds) =>
    seeds.every((s) => s.error),
  );
  if (allSourcesFailed) {
    issues.push({
      severity: "warning",
      message: `All 5 suggestion sources failed across all seeds. Check network egress.`,
    });
  }
  return issues;
}
