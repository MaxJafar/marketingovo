// Topical clustering of keyword sets. Pure functions. Used by
// the topic-clusters module (Sprint 13).
//
// Algorithm overview:
//   1. For each input seed, fetch its top-N suggestions
//      (caller's job — usually via integrations:suggest).
//   2. Build a co-occurrence graph: nodes are seeds; edges
//      connect pairs whose Jaccard similarity over their
//      suggestion sets is >= minSimilarity.
//   3. Find connected components — each component is a
//      "cluster".
//   4. For each cluster, pick a hub: the seed whose suggestion
//      set has the highest overlap with the rest of the
//      cluster's union of suggestions.
//   5. For each cluster, pick spokes: suggestions from the hub
//      that are NOT already in another cluster member's
//      suggestion set (i.e. content angles the hub could
//      expand into that members don't yet cover).
//
// Why this is useful: an operator with 10-30 seed terms
// (e.g. the topics they want to rank for) gets an instant map
// of "these 4 belong together as a single hub-and-spoke
// pillar, these 6 are separate topics". That's the heart of
// topical authority SEO.

export interface SeedSuggestions {
  /** The original seed term. */
  seed: string;
  /** All suggestions for this seed (deduplicated, lowercased). */
  suggestions: readonly string[];
  /** Optional per-suggestion metadata (priority / source). */
  meta?: ReadonlyMap<string, number>;
}

export interface TopicCluster {
  /** Cluster id (zero-based index). */
  id: number;
  /** The hub term (most central member). */
  hub: string;
  /** All members (including the hub). */
  members: string[];
  /** Jaccard-based cohesion score 0..1 (average pairwise
   *  similarity among members; 1.0 = perfect overlap). */
  cohesion: number;
  /** Suggestion overlap, in absolute terms (size of the
   *  union of all members' suggestions). */
  suggestionPoolSize: number;
  /** Spokes: hub's suggestions that are NOT in any other
   *  member's suggestion set. Sorted desc by meta (default:
   *  alphabetical). Limited to maxSpokes. */
  spokes: string[];
  /** One-paragraph human summary. */
  summary: string;
}

export interface ClusterOptions {
  /** Minimum Jaccard similarity to draw an edge (default 0.3). */
  minSimilarity?: number;
  /** Maximum number of spokes per cluster (default 8). */
  maxSpokes?: number;
}

/**
 * Build clusters from a list of (seed, suggestions) pairs.
 * Pure function. Exported for unit testing.
 */
export function cluster(
  inputs: readonly SeedSuggestions[],
  opts: ClusterOptions = {},
): TopicCluster[] {
  const minSim = opts.minSimilarity ?? 0.3;
  const maxSpokes = opts.maxSpokes ?? 8;

  if (inputs.length === 0) return [];
  if (inputs.length === 1) {
    return [singletonCluster(0, inputs[0]!, maxSpokes)];
  }

  // Lowercase + dedupe per seed. Sets make overlap O(1) below.
  const sets: string[][] = inputs.map((i) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of i.suggestions) {
      const k = s.trim().toLowerCase();
      if (!k) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(k);
    }
    return out;
  });
  const seedKeys = inputs.map((i) => i.seed.trim().toLowerCase());

  // Build a Union-Find over input indices.
  const uf = new UnionFind(inputs.length);
  for (let a = 0; a < inputs.length; a++) {
    for (let b = a + 1; b < inputs.length; b++) {
      const sim = jaccard(sets[a]!, sets[b]!);
      if (sim >= minSim) uf.union(a, b);
    }
  }

  // Group by root.
  const groups = new Map<number, number[]>();
  for (let i = 0; i < inputs.length; i++) {
    const r = uf.find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(i);
  }

  // Build clusters.
  const clusters: TopicCluster[] = [];
  let clusterId = 0;
  for (const group of groups.values()) {
    const clusterMembers = group.map((i) => seedKeys[i]!);
    const memberSets = group.map((i) => sets[i]!);

    // Pick the hub: the seed whose suggestion set has the
    // highest overlap with the union of all other members.
    const unionOther = Array.from(unionAll(memberSets));
    let hubIdx = group[0]!;
    let hubScore = jaccard(memberSets[0]!, unionOther);
    for (let i = 1; i < group.length; i++) {
      const s = jaccard(memberSets[i]!, unionOther);
      if (s > hubScore) {
        hubScore = s;
        hubIdx = group[i]!;
      }
    }
    const hub = seedKeys[hubIdx]!;
    const hubSet = new Set(sets[hubIdx]!);
    const otherMembersUnion = new Set<string>();
    for (let i = 0; i < group.length; i++) {
      if (i === hubIdx) continue;
      for (const s of sets[group[i]!]!) otherMembersUnion.add(s);
    }
    const spokes: string[] = [];
    for (const s of hubSet) {
      if (!otherMembersUnion.has(s)) spokes.push(s);
      if (spokes.length >= maxSpokes) break;
    }

    const cohesion = pairwiseAvg(memberSets);
    const poolSize = unionAll(memberSets).size;

    clusters.push({
      id: clusterId++,
      hub,
      members: clusterMembers,
      cohesion,
      suggestionPoolSize: poolSize,
      spokes,
      summary: buildSummary(hub, clusterMembers, spokes, cohesion),
    });
  }

  // Stable sort: largest clusters first, then highest cohesion.
  clusters.sort(
    (a, b) => b.members.length - a.members.length || b.cohesion - a.cohesion,
  );
  // Re-index ids after sort.
  for (let i = 0; i < clusters.length; i++) clusters[i]!.id = i;
  return clusters;
}

function singletonCluster(
  id: number,
  input: SeedSuggestions,
  maxSpokes: number,
): TopicCluster {
  const seed = input.seed.trim().toLowerCase();
  const spokes = input.suggestions
    .slice(0, maxSpokes)
    .map((s) => s.trim().toLowerCase());
  return {
    id,
    hub: seed,
    members: [seed],
    cohesion: 1,
    suggestionPoolSize: input.suggestions.length,
    spokes,
    summary: `Solo cluster: "${seed}" has no overlap with other seeds. May be a niche topic — verify intent before treating as part of a pillar.`,
  };
}

/**
 * Jaccard similarity: |A ∩ B| / |A ∪ B|. Returns 0 for two
 * empty sets. Exported for unit testing.
 */
export function jaccard(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const aSet = new Set(a);
  const bSet = new Set(b);
  let inter = 0;
  for (const x of aSet) if (bSet.has(x)) inter += 1;
  const union = aSet.size + bSet.size - inter;
  return union === 0 ? 0 : inter / union;
}

function pairwiseAvg(sets: readonly (readonly string[])[]): number {
  if (sets.length < 2) return 1;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      sum += jaccard(sets[i]!, sets[j]!);
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
}

function unionAll(sets: readonly (readonly string[])[]): Set<string> {
  const out = new Set<string>();
  for (const s of sets) for (const x of s) out.add(x);
  return out;
}

function buildSummary(
  hub: string,
  members: readonly string[],
  spokes: readonly string[],
  cohesion: number,
): string {
  const verdict =
    cohesion >= 0.6
      ? "tight cluster"
      : cohesion >= 0.3
        ? "loose cluster"
        : "weak cluster";
  const memberList =
    members.length > 5
      ? `${members.slice(0, 5).join(", ")}, +${members.length - 5} more`
      : members.join(", ");
  const spokeList =
    spokes.length === 0 ? "none yet" : spokes.slice(0, 3).join(", ");
  return `Hub: "${hub}". Members (${members.length}): ${memberList}. ${verdict} (cohesion ${cohesion.toFixed(2)}). Spokes to expand: ${spokeList}.`;
}

class UnionFind {
  private parent: number[];
  private rank: number[];
  constructor(n: number) {
    this.parent = new Array(n);
    this.rank = new Array(n);
    for (let i = 0; i < n; i++) {
      this.parent[i] = i;
      this.rank[i] = 0;
    }
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]!]!; // path compression
      x = this.parent[x]!;
    }
    return x;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    if (this.rank[ra]! < this.rank[rb]!) {
      this.parent[ra] = rb;
    } else if (this.rank[ra]! > this.rank[rb]!) {
      this.parent[rb] = ra;
    } else {
      this.parent[rb] = ra;
      this.rank[ra]! += 1;
    }
  }
}
