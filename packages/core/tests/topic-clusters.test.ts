// Sprint 13: topic-clusters module tests.
//
// 1. jaccard: pure similarity function with edge cases
//    (empty, identical, disjoint).
// 2. cluster: Union-Find clustering with synthetic input
//    (no network). Three scenarios:
//    a. Two clearly-overlapping seeds → 1 cluster.
//    b. Three seeds, one outlier → 1 cluster + 1 solo.
//    c. Many seeds, multiple clusters, hub identification.
// 3. module contract: loader discovery, selfTest, input
//    validation.
// 4. end-to-end with mocked fetch (proves the URL
//    building + dispatch + cluster wiring works without
//    touching the real internet).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resolve } from "node:path";
import { loadModules } from "../src/modules/loader.js";
import {
  jaccard,
  cluster,
  type SeedSuggestions,
  type TopicCluster,
} from "../src/integrations/cluster.js";
import { suggestOne } from "../src/integrations/suggest.js";

const REPO = resolve(import.meta.dirname, "..");

describe("jaccard (Sprint 13 pure)", () => {
  it("returns 0 for two empty sets", () => {
    expect(jaccard([], [])).toBe(0);
  });
  it("returns 1 for two identical sets", () => {
    expect(jaccard(["a", "b"], ["a", "b"])).toBe(1);
  });
  it("returns 0 for two disjoint sets", () => {
    expect(jaccard(["a", "b"], ["c", "d"])).toBe(0);
  });
  it("computes |A∩B| / |A∪B| correctly for a partial overlap", () => {
    // A = {a, b, c}, B = {b, c, d}; |A∩B| = 2, |A∪B| = 4.
    expect(jaccard(["a", "b", "c"], ["b", "c", "d"])).toBeCloseTo(0.5, 5);
  });
  it("treats duplicate values within a set as a single element", () => {
    expect(jaccard(["a", "a", "b"], ["a", "b"])).toBe(1);
  });
});

describe("cluster (Sprint 13 pure Union-Find)", () => {
  it("returns [] for no input", () => {
    expect(cluster([])).toEqual([]);
  });
  it("returns a singleton cluster for one input", () => {
    const r = cluster([{ seed: "seo", suggestions: ["a", "b"] }]);
    expect(r).toHaveLength(1);
    expect(r[0]!.hub).toBe("seo");
    expect(r[0]!.members).toEqual(["seo"]);
  });
  it("groups two overlapping seeds into one cluster", () => {
    const r = cluster(
      [
        {
          seed: "seo tools",
          suggestions: [
            "seo tools free",
            "best seo tools",
            "seo audit",
            "tools for seo",
            "seo tools 2026",
          ],
        },
        {
          seed: "best seo tools",
          suggestions: [
            "best seo tools 2026",
            "best seo tools free",
            "seo audit",
            "tools for seo",
            "top tools",
          ],
        },
      ],
      { minSimilarity: 0.1 },
    );
    expect(r).toHaveLength(1);
    expect(r[0]!.members.sort()).toEqual(["best seo tools", "seo tools"]);
    // With only 2 members the hub is whichever has higher
    // overlap with the other one — they're equal, so the
    // first listed seed wins by tie-breaking. Just verify the
    // hub is one of the two members.
    expect(["seo tools", "best seo tools"]).toContain(r[0]!.hub);
  });
  it("keeps an outlier as a solo cluster", () => {
    const r = cluster(
      [
        { seed: "seo tools", suggestions: ["a", "b", "c"] },
        { seed: "best seo tools", suggestions: ["a", "b", "c"] },
        { seed: "crm software", suggestions: ["x", "y", "z"] },
      ],
      { minSimilarity: 0.3 },
    );
    expect(r).toHaveLength(2);
    // Sorted by members desc, then cohesion desc.
    expect(r[0]!.members.sort()).toEqual(["best seo tools", "seo tools"]);
    expect(r[1]!.members).toEqual(["crm software"]);
    expect(r[1]!.hub).toBe("crm software");
  });
  it("respects minSimilarity: high threshold = more solos", () => {
    const inputs: SeedSuggestions[] = [
      { seed: "a", suggestions: ["x", "y", "z", "w"] },
      { seed: "b", suggestions: ["x", "y", "q", "r"] },
    ];
    const loose = cluster(inputs, { minSimilarity: 0.1 });
    const tight = cluster(inputs, { minSimilarity: 0.9 });
    expect(loose).toHaveLength(1);
    expect(tight).toHaveLength(2);
  });
  it("computes cohesion as average pairwise Jaccard", () => {
    // Three identical sets → cohesion = 1.
    const r = cluster([
      { seed: "a", suggestions: ["x", "y", "z"] },
      { seed: "b", suggestions: ["x", "y", "z"] },
      { seed: "c", suggestions: ["x", "y", "z"] },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.cohesion).toBeCloseTo(1, 5);
  });
  it("identifies spokes as hub-only suggestions", () => {
    const r = cluster([
      {
        seed: "hub",
        suggestions: ["shared1", "shared2", "hubOnly1", "hubOnly2"],
      },
      { seed: "leaf1", suggestions: ["shared1", "shared2"] },
      { seed: "leaf2", suggestions: ["shared1", "shared2"] },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.hub).toBe("hub");
    // Spokes = hub's suggestions that aren't in any leaf.
    expect(r[0]!.spokes.sort()).toEqual(["hubonly1", "hubonly2"]);
  });
  it("caps spokes at maxSpokes", () => {
    const r = cluster(
      [
        {
          seed: "hub",
          suggestions: [
            "shared",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "h7",
            "h8",
            "h9",
            "h10",
          ],
        },
        { seed: "leaf", suggestions: ["shared"] },
      ],
      { maxSpokes: 3 },
    );
    expect(r[0]!.spokes).toHaveLength(3);
  });
  it("rebuilds ids after sort (stable, biggest first)", () => {
    const r = cluster([
      { seed: "a", suggestions: ["x", "y"] },
      { seed: "b", suggestions: ["x", "y"] },
      { seed: "c", suggestions: ["x", "y"] },
      { seed: "solo", suggestions: ["q", "r"] },
    ]);
    expect(r[0]!.id).toBe(0);
    expect(r[1]!.id).toBe(1);
    expect(r[0]!.members.length).toBeGreaterThan(r[1]!.members.length);
  });
});

describe("topic-clusters module contract (Sprint 13)", () => {
  it("loader discovers integrations:topic-clusters with the right shape", async () => {
    const r = await loadModules(resolve(REPO, "src/modules"));
    expect(r.errors).toEqual([]);
    const m = r.modules.find((m) => m.id === "integrations:topic-clusters");
    expect(m).toBeDefined();
    expect(m!.version).toBe("0.9.0");
    expect(m!.category).toBe("research");
    expect(m!.dependsOn).toEqual([]);
    expect(m!.inputSchema.required).toContain("seeds");
    expect(m!.outputSchema.properties).toHaveProperty("profile");
  });

  it("selfTest returns ok on Node 18+", async () => {
    const r = await loadModules(resolve(REPO, "src/modules"));
    const m = r.modules.find((m) => m.id === "integrations:topic-clusters")!;
    const t = await m.selfTest();
    expect(t.ok).toBe(true);
  });

  it("invoke({}) rejects with 'seeds' in the error message", async () => {
    const r = await loadModules(resolve(REPO, "src/modules"));
    const m = r.modules.find((m) => m.id === "integrations:topic-clusters")!;
    await expect(m.invoke({}, {} as never)).rejects.toThrow(/seeds/);
  });

  it("invoke rejects duplicate seed (case-insensitive)", async () => {
    const r = await loadModules(resolve(REPO, "src/modules"));
    const m = r.modules.find((m) => m.id === "integrations:topic-clusters")!;
    await expect(
      m.invoke({ seeds: ["SEO", "seo"] }, {} as never),
    ).rejects.toThrow(/duplicate/);
  });
});

describe("topic-clusters end-to-end (Sprint 13 with mocked fetch)", () => {
  it("clusters real seeds from a mocked suggest API", async () => {
    // Map seed → canned Google-shape response. We use a single
    // shared mock for all sources for test simplicity; the
    // URL builder was unit-tested in suggestOne tests already.
    const canned: Record<string, string> = {
      "seo tools":
        '["seo tools", ["seo tools free", "best seo tools", "seo audit", "seo tools 2026", "seo tools open source", "tools for seo"]]',
      "best seo tools":
        '["best seo tools", ["best seo tools 2026", "best seo tools free", "seo audit", "best seo tools 2025", "top seo tools", "tools for seo"]]',
      "crm software":
        '["crm software", ["crm software free", "best crm software", "crm for small business", "crm tools"]]',
    };
    const mockFetch: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      // Pull the query out of the URL.
      const u = new URL(url);
      const q = u.searchParams.get("q") ?? "";
      const body = canned[q.toLowerCase()] ?? '["x", []]';
      return new Response(body, { status: 200 });
    };
    // Use suggestAll via the module's path: build per-seed
    // suggestions, then cluster. We don't go through invoke()
    // because the module does a lot of orchestration we don't
    // need here; the cluster function is the unit under test.
    const seeds = ["seo tools", "best seo tools", "crm software"];
    const perSeed: SeedSuggestions[] = [];
    for (const s of seeds) {
      const r = await suggestOne(s, "google", 1000, mockFetch);
      perSeed.push({ seed: s, suggestions: r.hits.map((h) => h.term) });
    }
    const clusters: TopicCluster[] = cluster(perSeed, { minSimilarity: 0.2 });
    // Expect 2 clusters: [seo tools, best seo tools] + [crm software]
    expect(clusters.length).toBe(2);
    expect(clusters[0]!.members.sort()).toEqual([
      "best seo tools",
      "seo tools",
    ]);
    expect(clusters[1]!.members).toEqual(["crm software"]);
  });
});
