// Evidence-first public-web intelligence.
//
// This module is an independent implementation of the useful, defensible
// public-web capability: turn an explicitly supplied public website into
// a bounded, cited dossier and a small evidence graph. It intentionally does
// not perform username enumeration, account-recovery probing, authenticated
// scraping, contact enrichment, dark-web collection, or identity merging.

import { createHash } from "node:crypto";
import { crawl, type CrawlOutcome } from "../orchestrator.js";
import type { CrawledPage } from "../checks/index.js";
import { normalizeUrl } from "../core/safe-url.js";
import { collectCadenceForTarget, type FeedOutcome } from "./feed.js";
import { sameAsUrls } from "./brand-presence.js";

export type OsintEvidenceState =
  "available" | "missing" | "insufficient" | "contradictory";

export type OsintSourceClass =
  "public_web" | "first_party" | "licensed_provider" | "user_import";

export type OsintEntityType =
  "organization" | "domain" | "page" | "profile" | "feed";

export type OsintRelationshipType =
  "owns" | "links_to" | "same_as" | "publishes_via";

export interface OsintEvidence {
  id: string;
  kind: string;
  label: string;
  value: unknown;
  state: OsintEvidenceState;
  sourceUrl: string | null;
  sourceClass: OsintSourceClass;
  observedAt: string;
  confidence: number;
}

export interface OsintEntity {
  id: string;
  type: OsintEntityType;
  label: string;
  url: string | null;
  /** True means this is an exact URL/domain observation, not an inferred join. */
  exactMatch: boolean;
}

export interface OsintRelationship {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type: OsintRelationshipType;
  evidenceIds: string[];
}

export interface OsintTargetDossier {
  targetUrl: string;
  finalUrl: string | null;
  host: string | null;
  status: "available" | "partial" | "failed";
  pagesObserved: number;
  evidence: OsintEvidence[];
  entities: OsintEntity[];
  relationships: OsintRelationship[];
  publishingCadence: FeedOutcome | null;
  error: string | null;
}

export interface OsintFinding {
  id: string;
  severity: "info" | "low" | "medium";
  title: string;
  statement: string;
  evidenceIds: string[];
  confidence: number;
  actionable: boolean;
}

export interface OsintDossier {
  schemaVersion: "osint-dossier.v1";
  workflow: "osint-research";
  generatedAt: string;
  sourceBudget: number;
  targets: OsintTargetDossier[];
  findings: OsintFinding[];
  coverage: {
    state: OsintEvidenceState;
    targetsRequested: number;
    targetsCompleted: number;
    pagesObserved: number;
    evidenceAvailable: number;
  };
  policy: {
    collection: "public_web_only";
    personalData: "disabled";
    identityResolution: "disabled";
    authenticatedCollection: "disabled";
    darkWebCollection: "disabled";
  };
  limitations: string[];
}

export interface OsintResearchOptions {
  /** One project origin plus up to four explicitly supplied public targets. */
  targetUrls: readonly string[];
  maxUrls?: number;
  maxRuntimeMs?: number;
  signal?: AbortSignal;
  /** Injectable seams keep the dossier deterministic in unit tests. */
  crawlFn?: (options: Parameters<typeof crawl>[0]) => Promise<CrawlOutcome>;
  cadenceFn?: typeof collectCadenceForTarget;
  now?: Date;
}

const SOCIAL_HOSTS: ReadonlyArray<[string, string]> = [
  ["instagram.com", "Instagram"],
  ["linkedin.com", "LinkedIn"],
  ["youtube.com", "YouTube"],
  ["youtu.be", "YouTube"],
  ["facebook.com", "Facebook"],
  ["x.com", "X"],
  ["twitter.com", "X"],
  ["tiktok.com", "TikTok"],
  ["reddit.com", "Reddit"],
];

const LIMITS = {
  maxTargets: 5,
  maxUrls: 100,
  maxEvidencePerTarget: 200,
  maxProfileLinks: 50,
};

function stableId(prefix: string, value: string): string {
  return `${prefix}-${createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 16)}`;
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function cleanText(
  value: string | null | undefined,
  max = 2_000,
): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/gu, " ").trim();
  return normalized ? normalized.slice(0, max) : null;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./u, "");
  } catch {
    return null;
  }
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function socialPlatform(url: string): string | null {
  const host = hostOf(url);
  if (!host) return null;
  return (
    SOCIAL_HOSTS.find(
      ([suffix]) => host === suffix || host.endsWith(`.${suffix}`),
    )?.[1] ?? null
  );
}

function urlOrNull(value: string): string | null {
  try {
    return normalizeUrl(value).href;
  } catch {
    return null;
  }
}

function evidence(
  target: string,
  kind: string,
  label: string,
  value: unknown,
  state: OsintEvidenceState,
  observedAt: string,
  confidence: number,
  sourceUrl: string | null = target,
): OsintEvidence {
  return {
    id: stableId(
      "evidence",
      `${target}|${kind}|${label}|${JSON.stringify(value)}`,
    ),
    kind,
    label,
    value,
    state,
    sourceUrl,
    sourceClass: "public_web",
    observedAt,
    confidence: clampConfidence(confidence),
  };
}

function entity(
  type: OsintEntityType,
  label: string,
  url: string | null,
  exactMatch = true,
): OsintEntity {
  return {
    id: stableId("entity", `${type}|${url ?? label}`),
    type,
    label,
    url,
    exactMatch,
  };
}

function relationship(
  fromEntityId: string,
  toEntityId: string,
  type: OsintRelationshipType,
  evidenceIds: string[],
): OsintRelationship {
  return {
    id: stableId(
      "relationship",
      `${fromEntityId}|${toEntityId}|${type}|${evidenceIds.join(",")}`,
    ),
    fromEntityId,
    toEntityId,
    type,
    evidenceIds: [...new Set(evidenceIds)],
  };
}

function addEvidence(
  target: string,
  out: OsintEvidence[],
  item: Omit<OsintEvidence, "id" | "sourceClass">,
): OsintEvidence {
  if (out.length >= LIMITS.maxEvidencePerTarget) return out[out.length - 1]!;
  const next: OsintEvidence = {
    ...item,
    id: stableId(
      "evidence",
      `${target}|${item.kind}|${item.label}|${JSON.stringify(item.value)}`,
    ),
    sourceClass: "public_web",
  };
  out.push(next);
  return next;
}

function firstPage(outcome: CrawlOutcome): CrawledPage | null {
  const pages = [...outcome.index.pages.values()];
  const start = urlOrNull(outcome.index.startUrl);
  return (
    pages.find((page) => urlOrNull(page.url) === start) ??
    pages.find((page) => page.parsed !== null) ??
    pages[0] ??
    null
  );
}

function socialLinks(
  outcome: CrawlOutcome,
): Array<{ url: string; platform: string }> {
  const values: Array<{ url: string; platform: string }> = [];
  const seen = new Set<string>();
  for (const page of outcome.index.pages.values()) {
    for (const raw of page.parsed?.externalLinks ?? []) {
      const url = urlOrNull(raw);
      const platform = url ? socialPlatform(url) : null;
      if (!url || !platform || seen.has(url)) continue;
      seen.add(url);
      values.push({ url, platform });
      if (values.length >= LIMITS.maxProfileLinks) return values;
    }
  }
  return values;
}

function contactAndPublicPaths(outcome: CrawlOutcome): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const page of outcome.index.pages.values()) {
    for (const raw of page.parsed?.internalLinks ?? []) {
      const url = urlOrNull(raw);
      if (!url || seen.has(url)) continue;
      try {
        const path = new URL(url).pathname.toLowerCase();
        if (
          !/(^|\/)(contact|about|press|media|support|security|privacy|terms)(\/|$)/u.test(
            path,
          )
        )
          continue;
      } catch {
        continue;
      }
      seen.add(url);
      found.push(url);
      if (found.length >= 25) return found;
    }
  }
  return found;
}

function targetFromFailure(
  target: string,
  error: unknown,
  now: string,
): OsintTargetDossier {
  const host = hostOf(target);
  const errorText = cleanText(
    error instanceof Error ? error.message : String(error),
    500,
  );
  const item = evidence(
    target,
    "target-fetch",
    "Public target fetch",
    errorText,
    "insufficient",
    now,
    0,
    urlOrNull(target),
  );
  const domain = entity("domain", host ?? target, urlOrNull(target));
  return {
    targetUrl: target,
    finalUrl: null,
    host,
    status: "failed",
    pagesObserved: 0,
    evidence: [item],
    entities: [domain],
    relationships: [],
    publishingCadence: null,
    error: errorText,
  };
}

async function scanTarget(
  target: string,
  options: OsintResearchOptions,
  observedAt: string,
): Promise<OsintTargetDossier> {
  const crawlFn = options.crawlFn ?? crawl;
  const cadenceFn = options.cadenceFn ?? collectCadenceForTarget;
  // OSINT is intentionally public-web-only. Unlike an audit, it has no
  // private-host escape hatch even when the caller has one elsewhere.
  const allowlist: string[] = [];
  const normalized = urlOrNull(target);
  if (!normalized)
    return targetFromFailure(target, "target URL is invalid", observedAt);

  try {
    const outcome = await crawlFn({
      startUrl: normalized,
      renderMode: "static",
      limits: {
        maxUrls: Math.min(options.maxUrls ?? 12, LIMITS.maxUrls),
        maxRuntimeMs: Math.min(options.maxRuntimeMs ?? 60_000, 600_000),
        allowPrivate: allowlist.length > 0,
      },
      privateHostAllowlist: allowlist,
      signal: options.signal,
    });
    options.signal?.throwIfAborted();

    const host = hostOf(outcome.report.startUrl) ?? hostOf(normalized);
    const origin = originOf(outcome.report.startUrl) ?? originOf(normalized);
    const home = firstPage(outcome);
    const evidenceItems: OsintEvidence[] = [];
    const entities: OsintEntity[] = [];
    const relationships: OsintRelationship[] = [];
    const domain = entity("domain", host ?? normalized, origin);
    // A supplied target identifies a domain, not its legal owner. Keep the
    // graph rooted in the exact domain observation and avoid an ownership join.
    entities.push(domain);

    const pages = [...outcome.index.pages.values()];
    const pageEvidence = addEvidence(normalized, evidenceItems, {
      kind: "crawl-coverage",
      label: "Public pages observed",
      value: pages.length,
      state: pages.length > 0 ? "available" : "insufficient",
      sourceUrl: normalized,
      observedAt,
      confidence: pages.length > 0 ? 1 : 0,
    });

    const title = cleanText(home?.parsed?.title);
    addEvidence(normalized, evidenceItems, {
      kind: "site-identity",
      label: "Home page title",
      value: title,
      state: title ? "available" : "missing",
      sourceUrl: home?.finalUrl ?? normalized,
      observedAt,
      confidence: title ? 1 : 0.9,
    });
    const description = cleanText(home?.parsed?.metaDescription);
    addEvidence(normalized, evidenceItems, {
      kind: "site-identity",
      label: "Meta description",
      value: description,
      state: description ? "available" : "missing",
      sourceUrl: home?.finalUrl ?? normalized,
      observedAt,
      confidence: description ? 1 : 0.9,
    });
    const canonical = cleanText(home?.parsed?.canonical, 2_048);
    addEvidence(normalized, evidenceItems, {
      kind: "site-identity",
      label: "Canonical declaration",
      value: canonical,
      state: canonical ? "available" : "missing",
      sourceUrl: home?.finalUrl ?? normalized,
      observedAt,
      confidence: canonical ? 1 : 0.9,
    });
    addEvidence(normalized, evidenceItems, {
      kind: "crawl-policy",
      label: "Robots result",
      value: home?.robotsAllowed ?? null,
      state:
        home?.robotsAllowed === true
          ? "available"
          : home?.robotsAllowed === false
            ? "contradictory"
            : "insufficient",
      sourceUrl: home?.finalUrl ?? normalized,
      observedAt,
      confidence:
        home?.robotsAllowed === null || home?.robotsAllowed === undefined
          ? 0.5
          : 1,
    });

    const sitemap = outcome.report.sitemap;
    if (sitemap) {
      addEvidence(normalized, evidenceItems, {
        kind: "discovery",
        label: "XML sitemap capture",
        value: {
          state: sitemap.state,
          sourceUrl: sitemap.sourceUrl,
          pageUrls: sitemap.pageUrls.length,
          files: sitemap.files.length,
          warnings: sitemap.warnings.length,
        },
        state: sitemap.state === "available" ? "available" : "insufficient",
        sourceUrl: sitemap.sourceUrl ?? origin,
        observedAt,
        confidence: sitemap.state === "available" ? 1 : 0.8,
      });
    } else {
      addEvidence(normalized, evidenceItems, {
        kind: "discovery",
        label: "XML sitemap capture",
        value: null,
        state: "missing",
        sourceUrl: origin ? `${origin}/sitemap.xml` : normalized,
        observedAt,
        confidence: 0.8,
      });
    }

    const profiles = socialLinks(outcome);
    for (const profile of profiles) {
      const item = addEvidence(normalized, evidenceItems, {
        kind: "social-profile",
        label: `${profile.platform} profile link`,
        value: profile.url,
        state: "available",
        sourceUrl: normalized,
        observedAt,
        confidence: 1,
      });
      const profileEntity = entity(
        "profile",
        `${profile.platform} profile`,
        profile.url,
      );
      entities.push(profileEntity);
      relationships.push(
        relationship(domain.id, profileEntity.id, "links_to", [item.id]),
      );
    }

    const sameAs = [
      ...new Set(
        pages.flatMap((page) => sameAsUrls(page.parsed?.jsonLd ?? [])),
      ),
    ]
      .map(urlOrNull)
      .filter((url): url is string => Boolean(url))
      .slice(0, LIMITS.maxProfileLinks);
    for (const url of sameAs) {
      const item = addEvidence(normalized, evidenceItems, {
        kind: "structured-identity",
        label: "schema.org sameAs claim",
        value: url,
        state: "available",
        sourceUrl: normalized,
        observedAt,
        confidence: 1,
      });
      const profileEntity = entity(
        "profile",
        "Structured identity target",
        url,
      );
      entities.push(profileEntity);
      relationships.push(
        relationship(domain.id, profileEntity.id, "same_as", [item.id]),
      );
    }

    const publicPaths = contactAndPublicPaths(outcome);
    if (publicPaths.length > 0) {
      for (const path of publicPaths.slice(0, 25)) {
        const item = addEvidence(normalized, evidenceItems, {
          kind: "public-channel",
          label: "Public business channel",
          value: path,
          state: "available",
          sourceUrl: normalized,
          observedAt,
          confidence: 0.95,
        });
        const pageEntity = entity("page", path, path);
        entities.push(pageEntity);
        relationships.push(
          relationship(domain.id, pageEntity.id, "links_to", [item.id]),
        );
      }
    }

    const serverValues = [
      ...new Set(
        pages
          .map(
            (page) =>
              Object.entries(page.headers).find(
                ([key]) => key.toLowerCase() === "server",
              )?.[1],
          )
          .map((value) => cleanText(value, 240))
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    for (const value of serverValues.slice(0, 5)) {
      addEvidence(normalized, evidenceItems, {
        kind: "response-metadata",
        label: "Server response header",
        value,
        state: "available",
        sourceUrl: home?.finalUrl ?? normalized,
        observedAt,
        confidence: 0.7,
      });
    }

    const cadence = await cadenceFn(normalized, {
      privateHostAllowlist: allowlist,
      signal: options.signal,
    });
    const cadenceEvidence = addEvidence(normalized, evidenceItems, {
      kind: "publishing-cadence",
      label: "RSS/Atom publication signal",
      value: cadence.cadence,
      state: cadence.cadence ? "available" : "insufficient",
      sourceUrl: cadence.cadence?.feedUrl ?? normalized,
      observedAt,
      confidence: cadence.cadence ? 1 : 0.8,
    });
    if (cadence.cadence?.feedUrl) {
      const feedEntity = entity(
        "feed",
        "RSS/Atom feed",
        cadence.cadence.feedUrl,
      );
      entities.push(feedEntity);
      relationships.push(
        relationship(domain.id, feedEntity.id, "publishes_via", [
          cadenceEvidence.id,
        ]),
      );
    }

    const finalUrl = home?.finalUrl ?? outcome.report.startUrl ?? normalized;
    return {
      targetUrl: normalized,
      finalUrl,
      host,
      status: pages.length > 0 ? "available" : "partial",
      pagesObserved: pages.length,
      evidence: [
        pageEvidence,
        ...evidenceItems.filter((item) => item.id !== pageEvidence.id),
      ],
      entities: dedupeEntities(entities),
      relationships: dedupeRelationships(relationships),
      publishingCadence: cadence,
      error: null,
    };
  } catch (error) {
    options.signal?.throwIfAborted();
    return targetFromFailure(normalized, error, observedAt);
  }
}

function dedupeEntities(items: OsintEntity[]): OsintEntity[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function dedupeRelationships(items: OsintRelationship[]): OsintRelationship[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function findingsForTarget(target: OsintTargetDossier): OsintFinding[] {
  const findings: OsintFinding[] = [];
  const social = target.evidence.filter(
    (item) => item.kind === "social-profile",
  );
  if (social.length > 0) {
    findings.push({
      id: stableId("finding", `${target.targetUrl}|social`),
      severity: "info",
      title: "Owned social profile links observed",
      statement: `${social.length} exact social profile link${social.length === 1 ? "" : "s"} ${social.length === 1 ? "is" : "are"} linked from the public site. This proves linkage, not account ownership or audience size.`,
      evidenceIds: social.map((item) => item.id),
      confidence: 1,
      actionable: true,
    });
  }
  const cadence = target.evidence.find(
    (item) => item.kind === "publishing-cadence",
  );
  if (cadence?.state === "available") {
    findings.push({
      id: stableId("finding", `${target.targetUrl}|cadence`),
      severity: "info",
      title: "Public publishing signal available",
      statement:
        "The target exposes an RSS/Atom feed with dated publication observations. Cadence is descriptive and does not imply reach, engagement, or revenue.",
      evidenceIds: [cadence.id],
      confidence: cadence.confidence,
      actionable: true,
    });
  }
  const structured = target.evidence.filter(
    (item) => item.kind === "structured-identity",
  );
  if (structured.length > 0) {
    findings.push({
      id: stableId("finding", `${target.targetUrl}|same-as`),
      severity: "info",
      title: "Structured identity claims observed",
      statement: `${structured.length} schema.org sameAs claim${structured.length === 1 ? "" : "s"} ${structured.length === 1 ? "is" : "are"} present. Claims are retained as source evidence and are not treated as verified identity joins.`,
      evidenceIds: structured.map((item) => item.id),
      confidence: 1,
      actionable: true,
    });
  }
  if (target.status === "failed") {
    findings.push({
      id: stableId("finding", `${target.targetUrl}|failed`),
      severity: "low",
      title: "Public target could not be fully observed",
      statement:
        "The target fetch failed or was blocked. Missing observations are not interpreted as absent capabilities.",
      evidenceIds: target.evidence.map((item) => item.id),
      confidence: 0,
      actionable: false,
    });
  }
  return findings;
}

/**
 * Build a bounded public-web OSINT dossier for explicitly supplied targets.
 *
 * The function is intentionally deterministic apart from the observedAt
 * timestamp and external source state. It preserves contradictory or missing
 * states, keeps source URLs attached to each observation, and never merges
 * people or accounts.
 */
export async function runOsintResearch(
  options: OsintResearchOptions,
): Promise<OsintDossier> {
  const targets: string[] = [];
  const seenTargets = new Set<string>();
  for (const raw of options.targetUrls) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const dedupeKey = urlOrNull(trimmed) ?? trimmed;
    if (seenTargets.has(dedupeKey)) continue;
    seenTargets.add(dedupeKey);
    targets.push(dedupeKey);
    if (targets.length >= LIMITS.maxTargets) break;
  }
  if (targets.length === 0)
    throw new Error("osint-research requires at least one target URL");
  const observedAt = (options.now ?? new Date()).toISOString();
  const dossiers: OsintTargetDossier[] = [];
  for (const target of targets) {
    options.signal?.throwIfAborted();
    dossiers.push(await scanTarget(target, options, observedAt));
  }
  const findings = dossiers.flatMap(findingsForTarget);
  const evidenceAvailable = dossiers.reduce(
    (sum, target) =>
      sum + target.evidence.filter((item) => item.state === "available").length,
    0,
  );
  const pagesObserved = dossiers.reduce(
    (sum, target) => sum + target.pagesObserved,
    0,
  );
  const targetsCompleted = dossiers.filter(
    (target) => target.status !== "failed",
  ).length;
  const coverageState: OsintEvidenceState =
    targetsCompleted === 0
      ? "missing"
      : targetsCompleted < targets.length
        ? "insufficient"
        : evidenceAvailable > 0
          ? "available"
          : "insufficient";
  return {
    schemaVersion: "osint-dossier.v1",
    workflow: "osint-research",
    generatedAt: observedAt,
    sourceBudget: targets.length,
    targets: dossiers,
    findings,
    coverage: {
      state: coverageState,
      targetsRequested: targets.length,
      targetsCompleted,
      pagesObserved,
      evidenceAvailable,
    },
    policy: {
      collection: "public_web_only",
      personalData: "disabled",
      identityResolution: "disabled",
      authenticatedCollection: "disabled",
      darkWebCollection: "disabled",
    },
    limitations: [
      "Only explicitly supplied public HTTP(S) targets and their same-origin crawl pages were observed.",
      "Social results are exact links published by the site; no platform profile was fetched or authenticated.",
      "Missing measurements remain unavailable and are never treated as zero.",
      "No people, email-registration, breach, contact-enrichment, or identity-resolution behavior is enabled.",
      "Feed cadence is descriptive publication evidence, not audience, engagement, customer, or revenue evidence.",
    ],
  };
}
