// Orchestrator: ties together frontier, renderer, robots, parser, checks.
// Exposes a single async function `crawl` that returns a Report.
//
// v0.2 swap: `Fetcher` is replaced by `Renderer` (which can be
// `static` or `js`). The contract is the same `RenderedPage` shape.
// All other components (frontier, robots, rate limit, parser,
// checks, report) are unchanged.
//
// Design:
//   - A single thread of work pulls from the frontier.
//   - The frontier is the queue, the pages map is the index.
//   - Concurrency is bounded by a semaphore; each worker dequeues one
//     entry, renders it, parses it, and pushes discovered internal
//     links back into the frontier. Stop conditions: deadline, empty
//     frontier + drained in-flight, maxUrls reached.

import { RateLimiter } from "./core/rate.js";
import { RobotsCache } from "./core/robots.js";
import { Frontier, type FrontierEntry } from "./frontier.js";
import { parsePage, type ParsedPage } from "./parser.js";
import { runAllChecks } from "./checks/index-all.js";
import { getSitemapSnapshot } from "./checks/sitemap.js";
import {
  buildReport,
  type PerformanceComparisonSummary,
  type Report,
} from "./core/report/index.js";
import { AuditLog, newRunId } from "./core/audit.js";
import { loadLimits, validateMaxUrls, type Limits } from "./core/limits.js";
import { envStr } from "./env.js";
import {
  buildAuthHeader,
  buildCookieHeader,
  buildUserAgent,
  loadCrawlConfig,
  type CrawlConfig,
} from "./core/config.js";
import type { CrawledPage, CrawlIndex } from "./checks/index.js";
import {
  createRenderer,
  type Renderer,
  type RenderedPage,
} from "./renderer.js";
import {
  applyExtraction,
  loadExtractors,
  type ExtractorRule,
  validateExtractorRules,
} from "./extraction.js";
import { buildComparablePerformanceWindows } from "./integrations/google/analytics-window.js";

export interface CrawlOptions {
  startUrl: string;
  seedUrls?: string[];
  /** Restrict a verification crawl to this exact canonical URL cohort. */
  exactUrls?: string[];
  limits?: Partial<Limits>;
  includePattern?: RegExp;
  excludePattern?: RegExp;
  renderMode?: "static" | "js";
  collectVitals?: boolean;
  /** Project root — used to load custom-rules.json and similar. */
  projectRoot?: string;
  /** Validated caller-owned extraction rules. Falls back to the legacy env input. */
  extractors?: ExtractorRule[];
  /** GSC site URL (e.g. "sc-domain:example.com" or "https://example.com/"). Triggers real-world data enrichment. */
  gscSiteUrl?: string;
  /** GA4 property id (e.g. "123456789"). Triggers real-world traffic enrichment. */
  ga4PropertyId?: string;
  /** Vault-backed token managers supplied by the local runtime. */
  googleTokens?: {
    gsc?: import("./integrations/google/oauth.js").GoogleAccessTokenManager;
    ga4?: import("./integrations/google/oauth.js").GoogleAccessTokenManager;
  };
  /** Optional PageSpeed Insights enrichment using an ephemeral vault API key. */
  pageSpeedInsights?: {
    apiKey?: string;
    strategy?: import("./integrations/psi.js").PsiStrategy;
  };
  /** Provider-only transport injection. Defaults to exact-host DNS-pinned HTTPS. */
  providerFetch?: typeof fetch;
  /** Optional UTC clock seam for reproducible comparison windows. */
  performanceComparisonAsOf?: Date;
  /** Lighthouse mode. Default "off". "home" runs the start URL only. */
  lighthouse?: import("./integrations/lighthouse.js").LighthouseMode;
  onProgress?: (state: {
    crawled: number;
    queue: number;
    elapsedMs: number;
  }) => void;
  signal?: AbortSignal;
  /** Exact private host/IP allowlist. Supplying [] disables the legacy global flag. */
  privateHostAllowlist?: string[];
}

export interface CrawlOutcome {
  report: Report;
  runId: string;
  /** The full CrawlIndex used to build the report. Modules
   *  that depend on 'crawl' (the Sprint 2 synthetic dependency)
   *  read this directly. The report is a view over the index
   *  tailored for human/operator consumption; the index is the
   *  complete data structure. */
  index: CrawlIndex;
}

export async function crawl(opts: CrawlOptions): Promise<CrawlOutcome> {
  opts.signal?.throwIfAborted();
  const limits = mergeLimits(opts.limits);
  const enforcePrivateHostAllowlist = opts.privateHostAllowlist !== undefined;
  const privateHostAllowlist = [
    ...new Set(
      (opts.privateHostAllowlist ?? []).map((host) => host.toLowerCase()),
    ),
  ];
  const allowPrivate = enforcePrivateHostAllowlist
    ? privateHostAllowlist.length > 0
    : limits.allowPrivate;
  const projectRoot =
    opts.projectRoot ??
    envStr("AGENTSEO_PROJECT_ROOT", "SCREAMINGCLAW_PROJECT_ROOT", "") ??
    "";
  const mode = opts.renderMode ?? limits.renderMode;
  const crawlConfig = loadCrawlConfig();
  const userAgent = buildUserAgent(
    limits.userAgent,
    crawlConfig.userAgentSuffix,
  );
  const extractors = validateExtractorRules(
    opts.extractors ?? loadExtractors(),
  );
  const runId = newRunId();
  const audit = new AuditLog(runId);
  audit.info("crawl_start", {
    startUrl: opts.startUrl,
    maxUrls: limits.maxUrls,
    maxRuntimeMs: limits.maxRuntimeMs,
    renderMode: mode,
  });
  const renderer = await createRenderer(mode, limits);
  const rateLimiter = new RateLimiter(limits.requestsPerSecond);
  const robots = new RobotsCache(renderer, userAgent, {
    allowPrivate,
    privateHostAllowlist,
    enforcePrivateHostAllowlist,
    signal: opts.signal,
  });
  const frontier = new Frontier({
    startUrl: opts.startUrl,
    maxUrls: limits.maxUrls,
    includePattern: opts.includePattern,
    excludePattern: opts.excludePattern,
    seedUrls: opts.seedUrls,
    exactUrls: opts.exactUrls,
  });
  const pages = new Map<string, CrawledPage>();
  const startedAt = Date.now();
  const deadline = startedAt + limits.maxRuntimeMs;
  const sem = createSemaphore(limits.maxConcurrency);
  const inFlight = new Set<Promise<void>>();

  const schedule = (entry: FrontierEntry): void => {
    const job = sem
      .run(() =>
        processEntry(entry, {
          limits,
          renderer,
          rateLimiter,
          robots,
          pages,
          frontier,
          audit,
          crawlConfig,
          userAgent,
          extractors,
          collectVitals: opts.collectVitals ?? false,
          projectRoot,
          signal: opts.signal,
          allowPrivate,
          privateHostAllowlist,
          enforcePrivateHostAllowlist,
        }),
      )
      .finally(() => inFlight.delete(job));
    inFlight.add(job);
  };

  try {
    for (let i = 0; i < limits.maxConcurrency; i++) {
      if (opts.signal?.aborted) break;
      const e = frontier.next();
      if (!e) break;
      schedule(e);
    }
    while (true) {
      if (opts.signal?.aborted) {
        audit.info("crawl_cancelled", { crawled: pages.size });
        break;
      }
      if (Date.now() >= deadline) {
        audit.warn("deadline_reached", { crawled: pages.size });
        break;
      }
      if (inFlight.size === 0) break;
      if (opts.onProgress) {
        opts.onProgress({
          crawled: pages.size,
          queue: frontier.size(),
          elapsedMs: Date.now() - startedAt,
        });
      }
      await Promise.race(inFlight);
      while (inFlight.size < limits.maxConcurrency) {
        if (opts.signal?.aborted) break;
        const e = frontier.next();
        if (!e) break;
        schedule(e);
      }
    }
    if (inFlight.size > 0) {
      await Promise.allSettled(inFlight);
    }
    opts.signal?.throwIfAborted();
  } finally {
    await renderer.close();
  }

  // Concurrent workers can finish out of BFS order. Recompute the shortest
  // discovered path over the completed internal-link graph before checks use
  // click depth as evidence.
  stabilizeCrawlDiscovery(pages, [opts.startUrl, ...(opts.seedUrls ?? [])]);

  const index: CrawlIndex = {
    pages,
    startUrl: opts.startUrl,
    robots: new Map(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    config: limits,
  };
  const issues = await runAllChecks(index, {
    projectRoot,
  });
  opts.signal?.throwIfAborted();
  // Attach a default recommendation to every issue. Operators can
  // override per-check by setting issue.fix in the check itself.
  const { withRecommendations } = await import("./core/recommendations.js");
  const enriched = withRecommendations(issues);
  const report = await buildReportWithRealData(
    index,
    enriched,
    opts.gscSiteUrl,
    opts.ga4PropertyId,
    opts.googleTokens,
    opts.pageSpeedInsights,
    opts.providerFetch,
    opts.performanceComparisonAsOf,
    opts.lighthouse,
    allowPrivate,
    privateHostAllowlist,
    opts.signal,
  );
  audit.info("crawl_done", {
    crawled: pages.size,
    issues: issues.length,
    durationMs: index.durationMs,
    renderMode: mode,
  });
  audit.close();
  return { report, runId, index };
}

export function stabilizeCrawlDiscovery(
  pages: Map<string, CrawledPage>,
  seeds: readonly string[],
): void {
  const aliases = new Map<string, CrawledPage>();
  for (const page of pages.values()) {
    const requested = resourceUrl(page.url);
    if (requested) aliases.set(requested, page);
  }
  for (const page of pages.values()) {
    const final = resourceUrl(page.finalUrl);
    if (final && !aliases.has(final)) aliases.set(final, page);
  }

  const depth = new Map<string, number>();
  const referrer = new Map<string, string | null>();
  const queue: CrawledPage[] = [];
  for (const seed of seeds) {
    const page = aliases.get(resourceUrl(seed) ?? "");
    if (!page || depth.has(page.url)) continue;
    depth.set(page.url, 0);
    referrer.set(page.url, null);
    queue.push(page);
  }

  for (let index = 0; index < queue.length; index += 1) {
    const source = queue[index]!;
    const sourceDepth = depth.get(source.url);
    if (sourceDepth === undefined || !source.parsed) continue;
    for (const href of source.parsed.internalLinks) {
      const target = aliases.get(resourceUrl(href, source.finalUrl) ?? "");
      if (!target) continue;
      const candidate = sourceDepth + 1;
      const previous = depth.get(target.url);
      if (previous !== undefined && previous <= candidate) continue;
      depth.set(target.url, candidate);
      referrer.set(target.url, source.url);
      queue.push(target);
    }
  }

  for (const page of pages.values()) {
    const shortest = depth.get(page.url);
    if (shortest === undefined) continue;
    page.crawlDepth = shortest;
    page.discoveredFrom = referrer.get(page.url) ?? null;
  }
}

function resourceUrl(value: string, base?: string): string | null {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

async function buildReportWithRealData(
  index: CrawlIndex,
  issues: Array<{
    id: string;
    category: string;
    priority: "High" | "Medium" | "Low";
    message: string;
    urls: string[];
    fix?: string;
    detail?: Record<string, unknown>;
  }>,
  gscSiteUrl?: string,
  ga4PropertyId?: string,
  googleTokens?: CrawlOptions["googleTokens"],
  pageSpeedInsights?: CrawlOptions["pageSpeedInsights"],
  providerFetch?: typeof fetch,
  performanceComparisonAsOf?: Date,
  lighthouseMode: import("./integrations/lighthouse.js").LighthouseMode = "off",
  allowPrivate = false,
  privateHostAllowlist: readonly string[] = [],
  signal?: AbortSignal,
): Promise<ReturnType<typeof buildReport>> {
  signal?.throwIfAborted();
  const sitemap = (() => {
    try {
      return getSitemapSnapshot(new URL(index.startUrl).origin);
    } catch {
      return null;
    }
  })();
  // Build the baseline report first; realData stays undefined if no
  // integrations are configured.
  const hasTrends = !!(
    envStr("AGENTSEO_TRENDS_KEYWORDS", "SCREAMINGCLAW_TRENDS_KEYWORDS", "") ??
    ""
  ).trim();
  if (
    !gscSiteUrl &&
    !ga4PropertyId &&
    !pageSpeedInsights &&
    lighthouseMode === "off" &&
    !hasTrends
  ) {
    return buildReport(index, issues, undefined, undefined, sitemap);
  }
  const { GscClient } = await import("./integrations/google/gsc.js");
  const { Ga4Client } = await import("./integrations/google/ga4.js");

  const errors: string[] = [];
  const windows = buildComparablePerformanceWindows(performanceComparisonAsOf);
  const performanceComparison: PerformanceComparisonSummary | undefined =
    gscSiteUrl || ga4PropertyId
      ? {
          asOfDate: windows.asOfDate,
          calendarTimeZone: windows.calendarTimeZone,
          completeDataLagDays: windows.completeDataLagDays,
          windowDays: windows.windowDays,
          current: {
            periodStart: windows.current.startDate,
            periodEnd: windows.current.endDate,
          },
          previous: {
            periodStart: windows.previous.startDate,
            periodEnd: windows.previous.endDate,
          },
        }
      : undefined;

  const realData: import("./core/report/index.js").RealDataSummary = {
    // Backward-compatible aliases: legacy readers continue to receive the
    // current period and current-period rows in their established fields.
    periodStart: windows.current.startDate,
    periodEnd: windows.current.endDate,
    gsc: [],
    ga4: [],
    topQueries: [],
    sitemaps: [],
    errors,
    lighthouse: undefined,
    ...(performanceComparison ? { performanceComparison } : {}),
  };

  // Active audits accept Google credentials only through the explicit,
  // vault-backed runtime context. Legacy token-file helpers remain isolated
  // for import/backward compatibility and are never auto-discovered here.
  const gscToken = googleTokens?.gsc;
  const ga4Token = googleTokens?.ga4;

  if (gscSiteUrl && gscToken) {
    try {
      const gsc = new GscClient(gscToken, providerFetch);
      const fetchWindow = async (
        window: (typeof windows)["current"],
      ): Promise<
        NonNullable<PerformanceComparisonSummary["current"]["gsc"]>
      > => {
        const [perPage, topQueries, queryPages] = await Promise.all([
          gsc.perPage({
            siteUrl: gscSiteUrl,
            startDate: window.startDate,
            endDate: window.endDate,
          }),
          gsc.topQueries({
            siteUrl: gscSiteUrl,
            startDate: window.startDate,
            endDate: window.endDate,
          }),
          gsc.queryPages({
            siteUrl: gscSiteUrl,
            startDate: window.startDate,
            endDate: window.endDate,
          }),
        ]);
        return { perPage, topQueries, queryPages };
      };

      const current = await fetchWindow(windows.current);
      if (performanceComparison) performanceComparison.current.gsc = current;
      realData.gsc = current.perPage;
      realData.topQueries = current.topQueries;

      const previous = await fetchWindow(windows.previous);
      if (performanceComparison) performanceComparison.previous.gsc = previous;
      signal?.throwIfAborted();
    } catch (err) {
      signal?.throwIfAborted();
      errors.push(`GSC comparison: ${(err as Error).message}`);
    }

    try {
      const gsc = new GscClient(gscToken, providerFetch);
      realData.sitemaps = await gsc.sitemaps(gscSiteUrl);
      signal?.throwIfAborted();
    } catch (err) {
      signal?.throwIfAborted();
      errors.push(`GSC sitemaps: ${(err as Error).message}`);
    }
  } else if (gscSiteUrl && !gscToken) {
    errors.push("GSC: credentials are not connected");
  }

  if (ga4PropertyId && ga4Token) {
    try {
      const ga4 = new Ga4Client(ga4Token, ga4PropertyId, providerFetch);
      const current = await ga4.perPage({
        startDate: windows.current.startDate,
        endDate: windows.current.endDate,
      });
      realData.ga4 = current;
      if (performanceComparison) {
        performanceComparison.current.ga4 = { perPage: current };
      }

      const previous = await ga4.perPage({
        startDate: windows.previous.startDate,
        endDate: windows.previous.endDate,
      });
      if (performanceComparison) {
        performanceComparison.previous.ga4 = { perPage: previous };
      }
      signal?.throwIfAborted();
    } catch (err) {
      signal?.throwIfAborted();
      errors.push(`GA4 comparison: ${(err as Error).message}`);
    }
  } else if (ga4PropertyId && !ga4Token) {
    errors.push("GA4: credentials are not connected");
  }

  if (pageSpeedInsights) {
    try {
      const { psiReport } = await import("./integrations/psi.js");
      realData.pageSpeedInsights = [
        await psiReport(index.startUrl, {
          strategy: pageSpeedInsights.strategy ?? "mobile",
          ...(pageSpeedInsights.apiKey
            ? { apiKey: pageSpeedInsights.apiKey }
            : {}),
          ...(providerFetch ? { fetchImpl: providerFetch } : {}),
        }),
      ];
      signal?.throwIfAborted();
    } catch (err) {
      signal?.throwIfAborted();
      errors.push(`PageSpeed Insights: ${(err as Error).message}`);
    }
  }

  // Lighthouse enrichment. We share one Chrome across all scored
  // URLs, fail soft if Chrome can't launch, and surface per-URL
  // errors in the report (operator visibility).
  const lighthouseMod = await import("./integrations/lighthouse.js");
  type LighthouseReport =
    import("./integrations/lighthouse.js").LighthouseReport;
  let lighthouse: LighthouseReport[] | undefined;
  if (lighthouseMode !== "off" && (await lighthouseMod.preloadDeps()).ok) {
    const allUrls = Array.from(index.pages.keys());
    const targets = lighthouseMod.pickUrlsForLighthouse(
      lighthouseMode,
      allUrls,
      index.startUrl,
    );
    if (targets.length > 0) {
      try {
        const chrome = await lighthouseMod.launchChrome({
          allowPrivate,
          allowedPrivateHosts: [...privateHostAllowlist],
        });
        try {
          lighthouse = [];
          for (const url of targets) {
            signal?.throwIfAborted();
            try {
              const r = await lighthouseMod.runLighthouse({
                url,
                port: chrome.port,
                allowPrivate,
              });
              lighthouse.push(r);
            } catch (err) {
              signal?.throwIfAborted();
              lighthouse.push({
                url,
                finalUrl: url,
                fetchTime: new Date().toISOString(),
                scores: {
                  performance: null,
                  accessibility: null,
                  bestPractices: null,
                  seo: null,
                },
                topAudits: [],
                raw: null,
                durationMs: 0,
                error: (err as Error).message,
              });
            }
          }
        } finally {
          await chrome.kill();
        }
      } catch (err) {
        signal?.throwIfAborted();
        errors.push(`Lighthouse: ${(err as Error).message}`);
      }
    }
  } else if (
    lighthouseMode !== "off" &&
    !(await lighthouseMod.preloadDeps()).ok
  ) {
    errors.push(
      "Lighthouse: lighthouse npm package not installed (run `npm install`)",
    );
  }

  if (lighthouse) realData.lighthouse = lighthouse;

  // Trends enrichment: when SCREAMINGCLAW_TRENDS_KEYWORDS is set
  // (comma-separated), fetch interest-over-time for each keyword
  // and surface a topic-momentum section in the report. We never
  // auto-pick keywords — the operator (or agent) must opt in.
  const trendsKeywords = (
    envStr("AGENTSEO_TRENDS_KEYWORDS", "SCREAMINGCLAW_TRENDS_KEYWORDS", "") ??
    ""
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (trendsKeywords.length > 0) {
    const trendsMod = await import("./integrations/trends.js");
    if ((await trendsMod.preloadDeps()).ok) {
      realData.trends = [];
      for (const kw of trendsKeywords) {
        signal?.throwIfAborted();
        realData.trends.push(
          await trendsMod.trendsInterest({ keyword: kw, days: 90 }),
        );
      }
    } else {
      errors.push("Trends: google-trends-api not installed");
    }
  }

  return buildReport(index, issues, realData, lighthouse, sitemap);
}

function mergeLimits(overrides?: Partial<Limits>): Limits {
  const base = loadLimits();
  const merged = overrides ? { ...base, ...overrides } : base;
  return { ...merged, maxUrls: validateMaxUrls(merged.maxUrls) };
}

interface Semaphore {
  run<T>(fn: () => Promise<T>): Promise<T>;
}

function createSemaphore(max: number): Semaphore {
  let active = 0;
  const waiters: Array<() => void> = [];
  return {
    async run<T>(fn: () => Promise<T>): Promise<T> {
      if (active >= max) {
        await new Promise<void>((resolve) => waiters.push(resolve));
      }
      active += 1;
      try {
        return await fn();
      } finally {
        active -= 1;
        const w = waiters.shift();
        if (w) w();
      }
    },
  };
}

interface ProcessCtx {
  limits: Limits;
  renderer: Renderer;
  rateLimiter: RateLimiter;
  robots: RobotsCache;
  pages: Map<string, CrawledPage>;
  frontier: Frontier;
  audit: AuditLog;
  crawlConfig: CrawlConfig;
  userAgent: string;
  extractors: ExtractorRule[];
  collectVitals: boolean;
  projectRoot: string;
  signal?: AbortSignal;
  allowPrivate: boolean;
  privateHostAllowlist: readonly string[];
  enforcePrivateHostAllowlist: boolean;
}

async function processEntry(
  entry: FrontierEntry,
  ctx: ProcessCtx,
): Promise<void> {
  await processOne(entry.url, entry.depth, entry.referrer, ctx);
}

async function processOne(
  url: string,
  depth: number,
  referrer: string | null,
  ctx: ProcessCtx,
): Promise<void> {
  ctx.signal?.throwIfAborted();
  const t0 = Date.now();
  let robotsAllowed: boolean | null = null;
  if (!ctx.limits.ignoreRobots) {
    const allowed = await ctx.robots.isAllowed(url);
    robotsAllowed = allowed;
    if (!allowed) {
      ctx.audit.info("robots_blocked", { url });
      ctx.pages.set(url, {
        url,
        finalUrl: url,
        crawlDepth: depth,
        discoveredFrom: referrer,
        status: 0,
        contentType: "",
        responseTimeMs: 0,
        bodyBytes: 0,
        redirectChain: [],
        headers: {},
        robotsAllowed: false,
        parsed: null,
        error: "blocked by robots.txt",
        fetchDurationMs: Date.now() - t0,
        extractions: [],
      });
      return;
    }
  }
  let parsedHost: string;
  try {
    parsedHost = new URL(url).host.toLowerCase();
  } catch {
    return;
  }
  await ctx.rateLimiter.acquire(parsedHost);
  let result: RenderedPage;
  try {
    const headers: Record<string, string> = { ...ctx.limits.customHeaders };
    if (ctx.crawlConfig.basicAuth) {
      const auth = buildAuthHeader(ctx.crawlConfig.basicAuth);
      if (auth) headers["authorization"] = auth;
    }
    if (ctx.crawlConfig.cookies.length > 0) {
      const cookie = buildCookieHeader(ctx.crawlConfig.cookies, parsedHost);
      if (cookie) headers["cookie"] = cookie;
    }
    result = await ctx.renderer.render(url, {
      timeoutMs: ctx.limits.requestTimeoutMs,
      maxBodyBytes: ctx.limits.maxBodyBytes,
      userAgent: ctx.userAgent,
      allowPrivate: ctx.allowPrivate,
      privateHostAllowlist: [...ctx.privateHostAllowlist],
      enforcePrivateHostAllowlist: ctx.enforcePrivateHostAllowlist,
      signal: ctx.signal,
      waitUntil: "networkidle",
      headers,
      maxRedirects: ctx.limits.maxRedirects,
    });
  } catch (err) {
    ctx.signal?.throwIfAborted();
    ctx.audit.warn("fetch_failed", { url, err: (err as Error).message });
    ctx.pages.set(url, {
      url,
      finalUrl: url,
      crawlDepth: depth,
      discoveredFrom: referrer,
      status: 0,
      contentType: "",
      responseTimeMs: 0,
      bodyBytes: 0,
      redirectChain: [],
      headers: {},
      robotsAllowed,
      parsed: null,
      error: (err as Error).message,
      fetchDurationMs: Date.now() - t0,
      extractions: [],
    });
    return;
  }
  const isHtml =
    result.contentType.toLowerCase().includes("text/html") ||
    result.contentType.toLowerCase().includes("application/xhtml");
  let parsed: ParsedPage | null = null;
  let extractions: import("./extraction.js").ExtractedField[] = [];
  let rawHtml: string | undefined;
  if (isHtml && result.status >= 200 && result.status < 300) {
    const html = result.body.toString("utf8");
    try {
      parsed = parsePage(html, result.finalUrl);
    } catch (err) {
      ctx.audit.warn("parse_failed", { url, err: (err as Error).message });
    }
    if (ctx.extractors.length > 0) {
      try {
        extractions = applyExtraction(html, ctx.extractors);
      } catch (err) {
        ctx.audit.warn("extraction_failed", {
          url,
          err: (err as Error).message,
        });
      }
    }
    if (ctx.limits.keepRawHtml) rawHtml = html;
  }
  ctx.pages.set(url, {
    url,
    finalUrl: result.finalUrl,
    crawlDepth: depth,
    discoveredFrom: referrer,
    status: result.status,
    contentType: result.contentType,
    responseTimeMs: result.responseTimeMs,
    bodyBytes: result.body.length,
    redirectChain: result.redirectChain ?? [],
    headers: result.headers,
    robotsAllowed,
    parsed,
    rawHtml,
    extractions,
    error: null,
    fetchDurationMs: Date.now() - t0,
    vitals: null,
  });
  // Optional Web Vitals collection. Requires JS renderer; cheap to
  // skip if static. We do this after parse so we don't block BFS
  // dispatch — the metrics are still available before the crawl
  // returns, but the next worker can proceed in parallel.
  if (
    ctx.collectVitals &&
    ctx.renderer.withLivePage &&
    isHtml &&
    result.status < 300
  ) {
    try {
      const { collectWebVitals } = await import("./web-vitals.js");
      const vitals = await collectWebVitals(
        ctx.renderer,
        result.finalUrl,
        ctx.userAgent,
        ctx.limits.requestTimeoutMs * 2,
        ctx.allowPrivate,
        [...ctx.privateHostAllowlist],
        ctx.signal,
        ctx.enforcePrivateHostAllowlist,
      );
      const page = ctx.pages.get(url);
      if (page) page.vitals = vitals;
    } catch (err) {
      ctx.signal?.throwIfAborted();
      ctx.audit.warn("vitals_failed", { url, err: (err as Error).message });
    }
  }
  if (!isHtml || result.status >= 300) return;
  if (!parsed) return;
  // Honor depth cap.
  if (ctx.crawlConfig.maxDepth > 0 && depth + 1 > ctx.crawlConfig.maxDepth) {
    void referrer;
    return;
  }
  // Nofollow handling: when followNofollow=false (default), skip
  // links marked rel="nofollow".
  const nofollowSet = new Set(parsed.nofollowLinks);
  const candidateLinks = ctx.crawlConfig.followNofollow
    ? parsed.internalLinks
    : parsed.internalLinks.filter((l) => !nofollowSet.has(l));
  for (const link of candidateLinks) {
    ctx.frontier.push(link, depth + 1, url);
  }
  void referrer;
}
