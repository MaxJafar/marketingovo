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

/**
 * Best on-site page for a keyword, drawn from the latest audit crawl.
 *
 * Answering "which of my pages should own this term" needs no keyword provider
 * — the crawl already knows every page and its title. A page is a candidate
 * only when it covers every content word in the keyword, so a partial overlap
 * ("running" matching a shoe page for "running shoe nutrition") is reported as
 * no target rather than a confident wrong one. Ties break toward the shortest
 * URL, which is the closest thing the crawl has to a canonical page.
 */
const TARGET_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

function keywordTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length > 1 && !TARGET_STOPWORDS.has(token));
}

export function buildTargetUrlIndex(
  auditArtifact: unknown,
): (keyword: string) => string | null {
  const pages = Array.isArray(record(auditArtifact)?.pages)
    ? (record(auditArtifact)!.pages as unknown[])
    : [];
  const candidates: Array<{ url: string; haystack: Set<string> }> = [];
  for (const item of pages) {
    const page = record(item);
    const url = text(page?.url);
    if (!url || page?.error) continue;
    let path = url;
    try {
      path = new URL(url).pathname;
    } catch {
      // Keep the raw string; a malformed URL still matches on its words.
    }
    candidates.push({
      url,
      haystack: new Set([
        ...keywordTokens(text(page?.title) ?? ""),
        ...keywordTokens(path),
      ]),
    });
  }
  if (candidates.length === 0) return () => null;

  return (keyword: string): string | null => {
    const tokens = keywordTokens(keyword);
    if (tokens.length === 0) return null;
    let best: { url: string; score: number } | null = null;
    for (const candidate of candidates) {
      if (!tokens.every((token) => candidate.haystack.has(token))) continue;
      // Prefer the page that says the least besides the keyword, and break
      // ties on the shorter URL.
      const score = candidate.haystack.size;
      if (
        !best ||
        score < best.score ||
        (score === best.score && candidate.url.length < best.url.length)
      ) {
        best = { url: candidate.url, score };
      }
    }
    return best?.url ?? null;
  };
}

export function keywordDashboardWorkspace(
  value: unknown,
  auditArtifact?: unknown,
): {
  opportunities: UnknownRecord[];
  clusters: UnknownRecord[];
  providerUsage: UnknownRecord | null;
} {
  const root = record(value);
  if (!root) return { opportunities: [], clusters: [], providerUsage: null };
  const targetFor = buildTargetUrlIndex(auditArtifact);
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
        targetUrl: targetFor(seed),
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
        targetUrl: targetFor(term),
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

/**
 * Technical health per host from a comparison artifact, used as the baseline
 * for the trend on a later one. Keyed by host including port, matching the
 * cadence and content-gap joins.
 */
function healthByHost(value: unknown): Map<string, number> {
  const out = new Map<string, number>();
  for (const { hostKey, row } of competitorRows(value)) {
    const health =
      typeof row.technicalHealth === "number" ? row.technicalHealth : null;
    if (health !== null) out.set(hostKey, health);
  }
  return out;
}

/** The public projection. `hostKey` is a join key and never leaves the server. */
export function competitorDashboardItems(
  value: unknown,
  baseline?: unknown,
): UnknownRecord[] {
  return competitorRows(value, baseline).map((entry) => entry.row);
}

function competitorRows(
  value: unknown,
  baseline?: unknown,
): Array<{ hostKey: string; row: UnknownRecord }> {
  const root = record(value);
  const sites = Array.isArray(root?.sites) ? root.sites : [];
  const generatedAt = text(root?.generatedAt);

  // A competitor's health number only means something as a trend. The previous
  // comparison for this site is the baseline; a rival absent from that run has
  // no baseline, so its change stays unavailable rather than reading as no
  // movement.
  const baselineHealth =
    baseline === undefined ? new Map<string, number>() : healthByHost(baseline);

  // Publishing cadence comes from each rival's own feed, keyed by host because
  // the crawl's final URL may differ from the target after redirects. The key
  // includes the port: two sites on the same hostname but different ports are
  // different sites, and keying on hostname alone silently gave the second
  // one's cadence to the first. A site with no feed is absent from this map and
  // reads as unavailable — not a zero implying they never publish.
  const cadenceByHost = new Map<string, Record<string, unknown>>();

  // Per-reference content-gap coverage, keyed the same way. A competitor
  // absent from this map was not analysed, which is why the count stays null
  // rather than collapsing to zero — "covers none of our gap terms" and "was
  // never measured" are opposite findings.
  const gapByHost = new Map<string, number>();
  const gapReport = record(root?.contentGap);
  const perReference = Array.isArray(gapReport?.perReference)
    ? gapReport.perReference
    : [];
  for (const item of perReference) {
    const reference = record(item);
    const url = text(reference?.url);
    const matched = finite(reference?.matchedTermCount);
    if (!url || matched === null) continue;
    try {
      gapByHost.set(new URL(url).host, matched);
    } catch {
      continue;
    }
  }
  const outcomes = Array.isArray(root?.publishingCadence)
    ? root.publishingCadence
    : [];
  for (const item of outcomes) {
    const outcome = record(item);
    const target = text(outcome?.target);
    const cadence = record(outcome?.cadence);
    if (!target || !cadence) continue;
    try {
      cadenceByHost.set(new URL(target).host, cadence);
    } catch {
      continue;
    }
  }
  return sites.slice(1).flatMap((item) => {
    const site = record(item);
    const url = text(site?.finalUrl) ?? text(site?.url);
    if (!site || !url) return [];
    let domain: string;
    let hostKey: string;
    try {
      const parsed = new URL(url);
      domain = parsed.hostname;
      hostKey = parsed.host;
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
    const cadence = cadenceByHost.get(hostKey);
    return [
      {
        hostKey,
        row: {
          id: stableId("competitor", domain),
          domain,
          technicalHealth,
          technicalHealthChange:
            technicalHealth !== null && baselineHealth.has(hostKey)
              ? technicalHealth - baselineHealth.get(hostKey)!
              : null,
          cadenceDays: finite(cadence?.cadenceDays),
          freshnessSeconds: finite(cadence?.freshnessSeconds),
          sharedKeywords: null,
          keywordGaps: null,
          contentGaps: gapByHost.has(hostKey)
            ? (gapByHost.get(hostKey) ?? null)
            : null,
          lastUpdatedAt: generatedAt,
        },
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

const MAX_OSINT_CHANGES = 100;

function osintTargets(value: unknown): UnknownRecord[] {
  const targets = record(value)?.targets;
  return Array.isArray(targets)
    ? targets.flatMap((item) => {
        const target = record(item);
        return target ? [target] : [];
      })
    : [];
}

function osintEvidence(target: UnknownRecord): UnknownRecord[] {
  const evidence = target.evidence;
  return Array.isArray(evidence)
    ? evidence.flatMap((item) => {
        const entry = record(item);
        return entry && text(entry.id) ? [entry] : [];
      })
    : [];
}

function osintEvidenceFingerprint(item: UnknownRecord): string {
  return JSON.stringify({
    kind: item.kind,
    label: item.label,
    value: item.value,
    state: item.state,
    sourceUrl: item.sourceUrl,
    confidence: item.confidence,
  });
}

function osintChange(
  targetUrl: string,
  change: "added" | "removed" | "changed",
  before: UnknownRecord | null,
  after: UnknownRecord | null,
): UnknownRecord {
  const category = text(after?.kind) ?? text(before?.kind) ?? "evidence";
  const label = text(after?.label) ?? text(before?.label) ?? category;
  const beforeId = text(before?.id);
  const afterId = text(after?.id);
  const evidenceIds = [beforeId, afterId].filter((value): value is string =>
    Boolean(value),
  );
  const confidence =
    change === "changed"
      ? Math.min(
          finite(before?.confidence) ?? 0,
          finite(after?.confidence) ?? 0,
        )
      : (finite(after?.confidence) ?? finite(before?.confidence) ?? 0);
  return {
    id: stableId(
      "osint-change",
      `${targetUrl}|${change}|${category}|${beforeId ?? ""}|${afterId ?? ""}`,
    ),
    targetUrl,
    change,
    category,
    label,
    before,
    after,
    sourceUrl: text(after?.sourceUrl) ?? text(before?.sourceUrl),
    evidenceIds,
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}

/**
 * Compare two public-web OSINT snapshots without inferring ownership or
 * treating an unavailable crawl as evidence that a signal disappeared.
 *
 * Evidence IDs are stable for the same target/kind/label/value, so a changed
 * state or source can be reported separately from an added or removed signal.
 * Failed and zero-page partial targets are skipped entirely: a blocked second
 * pass must not turn every previously observed profile or feed into a false
 * removal.
 */
export function osintDashboardWorkspace(
  value: unknown,
  baseline?: unknown,
): {
  dossier: UnknownRecord | null;
  previousGeneratedAt: string | null;
  compared: boolean;
  changes: UnknownRecord[];
} {
  const dossier = record(value);
  const previous = record(baseline);
  const previousGeneratedAt = text(previous?.generatedAt);
  if (!dossier || !previous) {
    return {
      dossier,
      previousGeneratedAt,
      compared: false,
      changes: [],
    };
  }

  const currentByTarget = new Map<string, UnknownRecord>();
  const previousByTarget = new Map<string, UnknownRecord>();
  for (const target of osintTargets(dossier)) {
    const url = text(target.targetUrl);
    if (url) currentByTarget.set(url, target);
  }
  for (const target of osintTargets(previous)) {
    const url = text(target.targetUrl);
    if (url) previousByTarget.set(url, target);
  }

  const changes: UnknownRecord[] = [];
  const targetUrls = [
    ...new Set([...currentByTarget.keys(), ...previousByTarget.keys()]),
  ].sort();
  for (const targetUrl of targetUrls) {
    if (changes.length >= MAX_OSINT_CHANGES) break;
    const current = currentByTarget.get(targetUrl);
    const prior = previousByTarget.get(targetUrl);
    const currentUnavailable =
      current?.status === "failed" ||
      (current?.status === "partial" &&
        (finite(current.pagesObserved) ?? 0) === 0);
    const priorUnavailable =
      prior?.status === "failed" ||
      (prior?.status === "partial" && (finite(prior.pagesObserved) ?? 0) === 0);
    if (!current || !prior || currentUnavailable || priorUnavailable) {
      continue;
    }
    const currentEvidence = new Map(
      osintEvidence(current).map((item) => [text(item.id)!, item]),
    );
    const previousEvidence = new Map(
      osintEvidence(prior).map((item) => [text(item.id)!, item]),
    );
    const evidenceIds = [
      ...new Set([...currentEvidence.keys(), ...previousEvidence.keys()]),
    ].sort();
    for (const evidenceId of evidenceIds) {
      if (changes.length >= MAX_OSINT_CHANGES) break;
      const after = currentEvidence.get(evidenceId) ?? null;
      const before = previousEvidence.get(evidenceId) ?? null;
      if (before && after) {
        if (
          osintEvidenceFingerprint(before) === osintEvidenceFingerprint(after)
        )
          continue;
        changes.push(osintChange(targetUrl, "changed", before, after));
      } else if (after) {
        changes.push(osintChange(targetUrl, "added", null, after));
      } else if (before) {
        changes.push(osintChange(targetUrl, "removed", before, null));
      }
    }
  }
  return {
    dossier,
    previousGeneratedAt,
    compared: true,
    changes,
  };
}

/**
 * The topics references cover that the target does not.
 *
 * Returned separately from the per-competitor rows because a gap term belongs
 * to the comparison as a whole, not to any single rival.
 */
export function contentGapTerms(value: unknown): UnknownRecord[] {
  const gapReport = record(record(value)?.contentGap);
  const missing = Array.isArray(gapReport?.missing) ? gapReport.missing : [];
  return missing.flatMap((item) => {
    const term = record(item);
    const label = text(term?.term);
    const refFreq = finite(term?.refFreq);
    if (!label || refFreq === null) return [];
    return [
      {
        term: label,
        referencesCovering: refFreq,
        referenceDensity: finite(term?.refDensity),
        targetDensity: finite(term?.targetDensity),
      },
    ];
  });
}

/**
 * Brand presence rows from an audit artifact.
 *
 * The audit only emits this section when the workspace declared brand profiles,
 * so an empty result means "not checked" and is reported by the caller as a
 * missing state rather than as "nothing is linked".
 */
export function brandPresenceItems(auditArtifact: unknown): UnknownRecord[] {
  const rows = Array.isArray(record(auditArtifact)?.brandPresence)
    ? (record(auditArtifact)!.brandPresence as unknown[])
    : [];
  return rows.flatMap((item) => {
    const entry = record(item);
    const label = text(entry?.label);
    const url = text(entry?.url);
    if (!label || !url) return [];
    const linkingPageCount = finite(entry?.linkingPageCount) ?? 0;
    const reachability = text(entry?.reachability);
    return [
      {
        id: stableId("brand", url.toLowerCase()),
        label,
        url,
        linkingPageCount,
        linkedFrom: Array.isArray(entry?.linkedFrom)
          ? entry.linkedFrom.filter(
              (value): value is string => typeof value === "string",
            )
          : [],
        declaredInSameAs: entry?.declaredInSameAs === true,
        reachability: ["reachable", "unreachable", "unchecked"].includes(
          reachability ?? "",
        )
          ? reachability
          : "unchecked",
        reachabilityDetail: text(entry?.reachabilityDetail),
      },
    ];
  });
}
