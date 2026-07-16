import { createHash } from "node:crypto";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stableId(prefix: string, value: string): string {
  return `${prefix}-${createHash("sha256").update(value).digest("hex").slice(0, 16)}`;
}

function normalizedIntent(value: unknown): string {
  const candidate = text(record(value)?.intent)?.toLowerCase();
  return [
    "informational",
    "commercial",
    "transactional",
    "navigational",
  ].includes(candidate ?? "")
    ? candidate!
    : "unknown";
}

function keywordProfile(value: unknown): UnknownRecord | null {
  const candidate = record(value);
  return record(candidate?.profile) ?? candidate;
}

export function keywordDashboardWorkspace(value: unknown): {
  opportunities: UnknownRecord[];
  clusters: UnknownRecord[];
  providerUsage: UnknownRecord | null;
} {
  const root = record(value);
  if (!root) return { opportunities: [], clusters: [], providerUsage: null };
  const profiles = Array.isArray(root.keywordProfiles)
    ? root.keywordProfiles.map(keywordProfile).filter(Boolean)
    : [keywordProfile(root)].filter(Boolean);
  const opportunities: UnknownRecord[] = [];
  const usageRecords: UnknownRecord[] = [];

  for (const profile of profiles as UnknownRecord[]) {
    const usage = record(profile.providerUsage);
    if (usage) usageRecords.push(usage);
    const seed = text(profile.seed);
    const strength = finite(profile.strength);
    if (seed) {
      opportunities.push({
        id: stableId("keyword", seed.toLowerCase()),
        keyword: seed,
        intent: normalizedIntent(profile.intent),
        position: null,
        clicks: null,
        impressions: null,
        volume: null,
        difficulty: null,
        opportunityScore:
          strength === null ? null : Math.max(0, Math.min(100, strength)),
        targetUrl: null,
        cluster: seed,
      });
    }
    const variants = Array.isArray(profile.variants) ? profile.variants : [];
    for (const item of variants) {
      const variant = record(item);
      const term = text(variant?.term);
      if (!term) continue;
      opportunities.push({
        id: stableId("keyword", term.toLowerCase()),
        keyword: term,
        intent: normalizedIntent(variant?.intent),
        position: null,
        clicks: null,
        impressions: null,
        volume: null,
        difficulty: null,
        opportunityScore: null,
        targetUrl: null,
        cluster: seed,
      });
    }
  }

  const clusterEnvelope = record(root.clusters);
  const clusterProfile = keywordProfile(clusterEnvelope);
  const rawClusters = Array.isArray(clusterProfile?.clusters)
    ? clusterProfile.clusters
    : [];
  const clusters = rawClusters.flatMap((item) => {
    const cluster = record(item);
    const hub = text(cluster?.hub);
    if (!hub) return [];
    const members = Array.isArray(cluster?.members)
      ? cluster.members.filter(
          (member): member is string => typeof member === "string",
        )
      : [];
    const spokes = Array.isArray(cluster?.spokes)
      ? cluster.spokes.filter(
          (spoke): spoke is string => typeof spoke === "string",
        )
      : [];
    const summary = text(cluster?.summary);
    return [
      {
        id: stableId("cluster", hub.toLowerCase()),
        name: hub,
        keywords: members.length + spokes.length,
        contentCoverage: null,
        recommendedBrief:
          summary ??
          (spokes.length > 0
            ? `Build a pillar for ${hub} and cover: ${spokes.slice(0, 5).join(", ")}.`
            : `Build a focused pillar page for ${hub}.`),
      },
    ];
  });

  const unique = new Map<string, UnknownRecord>();
  for (const opportunity of opportunities) {
    unique.set(String(opportunity.id), opportunity);
  }
  const providerUsage =
    usageRecords.length === 0
      ? null
      : {
          actualCostUsd: usageRecords.reduce(
            (sum, usage) => sum + (finite(usage.actualCostUsd) ?? 0),
            0,
          ),
          billableRequests: usageRecords.reduce(
            (sum, usage) => sum + (finite(usage.billableRequests) ?? 0),
            0,
          ),
          unreportedBillableRequests: usageRecords.reduce(
            (sum, usage) =>
              sum + (finite(usage.unreportedBillableRequests) ?? 0),
            0,
          ),
          freeRequests: usageRecords.reduce(
            (sum, usage) => sum + (finite(usage.freeRequests) ?? 0),
            0,
          ),
        };
  return { opportunities: [...unique.values()], clusters, providerUsage };
}

export function competitorDashboardItems(value: unknown): UnknownRecord[] {
  const root = record(value);
  const sites = Array.isArray(root?.sites) ? root.sites : [];
  const generatedAt = text(root?.generatedAt);
  return sites.slice(1).flatMap((item) => {
    const site = record(item);
    const url = text(site?.finalUrl) ?? text(site?.url);
    if (!site || !url) return [];
    let domain: string;
    try {
      domain = new URL(url).hostname;
    } catch {
      return [];
    }
    const pages = finite(site.pagesCrawled);
    const counts = record(site.issuesByPriority);
    const high = finite(counts?.High) ?? 0;
    const medium = finite(counts?.Medium) ?? 0;
    const low = finite(counts?.Low) ?? 0;
    const weighted = high + medium * 0.55 + low * 0.25;
    const technicalHealth =
      site.error || pages === null || pages <= 0
        ? null
        : Math.max(
            0,
            Math.round((1 - weighted / Math.max(1, pages * 2)) * 100),
          );
    return [
      {
        id: stableId("competitor", domain),
        domain,
        technicalHealth,
        technicalHealthChange: null,
        sharedKeywords: null,
        keywordGaps: null,
        contentGaps: null,
        lastUpdatedAt: generatedAt,
      },
    ];
  });
}

export function parseResearchArtifact(bytes: Uint8Array | null): unknown {
  if (!bytes || bytes.byteLength === 0 || bytes.byteLength > 4 * 1024 * 1024)
    return null;
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  } catch {
    return null;
  }
}
