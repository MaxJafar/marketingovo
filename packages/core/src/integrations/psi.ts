// PageSpeed Insights API v5 client (synchronous request, no SDK).
//
// Reference: https://developers.google.com/speed/docs/insights/v5/get-started
//
// Why a thin client instead of an SDK?
//   1. The PSI v5 response is a stable, well-documented JSON shape.
//   2. We want a small surface that fits the rest of golem-seo: a
//      `psiReport(url, opts)` function that returns a typed object
//      or throws on error.
//   3. No auth is required for low-volume calls. When the local runtime
//      supplies a vault-backed API key, we pass it explicitly to lift the
//      provider quota. Active code never reads secret environment values.
//
// Soft-fail: if the network call fails, we throw a typed error so
// the module can surface it as a failed module in the audit run
// (rather than crashing the whole run).

import { safePageSpeedFetch } from "@golem-seo/integrations";

const API =
  "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed";

export type PsiStrategy = "mobile" | "desktop";

export type PsiCategory =
  "performance" | "accessibility" | "best-practices" | "seo";

export interface PsiScore {
  /** Lighthouse 0-100 score, or null if the category wasn't run. */
  score: number | null;
  /** Title shown in the PSI UI (e.g. "Performance"). */
  title: string;
}

export interface PsiMetric {
  /** Lighthouse audit id (e.g. "largest-contentful-paint"). */
  id: string;
  title: string;
  /** Raw value (ms for timings, unitless for CLS). */
  value: number;
  /** Display string (e.g. "2.4 s"). */
  displayValue: string;
  /** Score 0..1, null = not scored. */
  score: number | null;
}

export interface PsiOpportunity {
  id: string;
  title: string;
  description: string;
  /** Estimated savings, in ms for perf, bytes for network. */
  savings: { ms?: number; bytes?: number };
  score: number | null;
}

export interface PsiReport {
  url: string;
  finalUrl: string;
  strategy: PsiStrategy;
  fetchTime: string;
  scores: Record<PsiCategory, PsiScore>;
  /** Core Web Vitals + other key timings. */
  metrics: PsiMetric[];
  /** Top opportunities sorted by potential savings (highest first). */
  opportunities: PsiOpportunity[];
  durationMs: number;
  /** Populated on failure (status code + message). */
  error: { status: number | null; message: string } | null;
}

export interface PsiOptions {
  strategy?: PsiStrategy;
  /** Only request these categories. Default: all four. */
  categories?: readonly PsiCategory[];
  /** Ephemeral vault-backed API key. Never read from process environment. */
  apiKey?: string;
  /** Per-request timeout in ms. Default 30_000. */
  timeoutMs?: number;
  /** Explicit transport injection for tests and controlled hosts. */
  fetchImpl?: typeof fetch;
}

const ALL_CATEGORIES: readonly PsiCategory[] = [
  "performance",
  "accessibility",
  "best-practices",
  "seo",
];

const TIMING_IDS: readonly string[] = [
  "first-contentful-paint",
  "largest-contentful-paint",
  "total-blocking-time",
  "cumulative-layout-shift",
  "speed-index",
  "interactive",
  "server-response-time",
  "first-meaningful-paint",
];

export class PsiApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
  ) {
    super(message);
    this.name = "PsiApiError";
  }
}

export function isAvailable(): boolean {
  return typeof fetch === "function";
}

function redactPsiMessage(message: string, apiKey: string): string {
  let redacted = message.replace(
    /https:\/\/pagespeedonline\.googleapis\.com\/[^\s?]+\?\S*/giu,
    "[PSI endpoint]",
  );
  if (apiKey) {
    redacted = redacted
      .split(apiKey)
      .join("[redacted]")
      .split(encodeURIComponent(apiKey))
      .join("[redacted]");
  }
  return redacted;
}

/**
 * Run PageSpeed Insights for a URL. Throws PsiApiError on transport
 * or non-2xx responses. The returned report is normalised to a stable
 * shape regardless of which categories were requested.
 */
export async function psiReport(
  url: string,
  opts: PsiOptions = {},
): Promise<PsiReport> {
  if (!isAvailable())
    throw new PsiApiError("global fetch() not available (Node < 18)", null);
  if (!url) throw new PsiApiError("url is required", null);

  const strategy: PsiStrategy = opts.strategy ?? "mobile";
  const categories =
    opts.categories && opts.categories.length > 0
      ? opts.categories
      : ALL_CATEGORIES;
  const apiKey = opts.apiKey?.trim() ?? "";
  const timeoutMs = opts.timeoutMs ?? 30_000;

  const params = new URLSearchParams();
  params.set("url", url);
  params.set("strategy", strategy);
  for (const c of categories) params.append("category", c);
  if (apiKey) params.set("key", apiKey);

  const started = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(
    () => ac.abort(new Error("PSI request timeout")),
    timeoutMs,
  );

  let res: Response;
  try {
    res = await (opts.fetchImpl ?? safePageSpeedFetch)(
      `${API}?${params.toString()}`,
      {
        method: "GET",
        headers: { accept: "application/json" },
        signal: ac.signal,
        redirect: "error",
      },
    );
  } catch (err) {
    clearTimeout(timer);
    const rawMessage = (err as Error).message || "fetch failed";
    // Some HTTP implementations include the request URL in transport errors.
    // Strip the query entirely so a PSI API key can never enter reports/logs.
    const message = redactPsiMessage(rawMessage, apiKey);
    throw new PsiApiError(`PSI request failed: ${message}`, null);
  }
  clearTimeout(timer);

  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      detail = redactPsiMessage(body.error?.message ?? "", apiKey);
    } catch {
      // body wasn't JSON; ignore
    }
    throw new PsiApiError(
      `PSI API ${res.status}: ${res.statusText}${detail ? ` — ${detail}` : ""}`,
      res.status,
    );
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch (err) {
    throw new PsiApiError(
      `PSI returned non-JSON body: ${(err as Error).message}`,
      res.status,
    );
  }

  return parsePsiResponse(json, url, strategy, Date.now() - started);
}

/** Exported for unit tests. */
export function parsePsiResponse(
  raw: unknown,
  requestedUrl: string,
  strategy: PsiStrategy,
  durationMs: number,
): PsiReport {
  // The PSI v5 response is { lighthouseResult, analysisUTCTimestamp,
  // id, requestedUrl, finalUrl, ... }. We tolerate missing or
  // malformed fields by yielding nulls rather than throwing, so
  // a partial response is still useful.
  if (!raw || typeof raw !== "object") {
    throw new PsiApiError("PSI returned empty body", 200);
  }
  const r = raw as Record<string, unknown>;
  const finalUrl =
    (r.finalUrl as string | undefined) ??
    (r.id as string | undefined) ??
    requestedUrl;
  const fetchTime =
    (r.analysisUTCTimestamp as string | undefined) ?? new Date().toISOString();
  const lh = (r.lighthouseResult as Record<string, unknown> | undefined) ?? {};
  const categories =
    (lh.categories as Record<string, unknown> | undefined) ?? {};
  const audits = (lh.audits as Record<string, unknown> | undefined) ?? {};

  const scores: Record<PsiCategory, PsiScore> = {
    performance: extractScore(categories.performance),
    accessibility: extractScore(categories.accessibility),
    "best-practices": extractScore(categories["best-practices"]),
    seo: extractScore(categories.seo),
  };

  const metrics: PsiMetric[] = [];
  for (const id of TIMING_IDS) {
    const a = audits[id] as Record<string, unknown> | undefined;
    if (!a) continue;
    metrics.push({
      id,
      title: (a.title as string | undefined) ?? id,
      value: typeof a.numericValue === "number" ? a.numericValue : 0,
      displayValue: (a.displayValue as string | undefined) ?? "",
      score: typeof a.score === "number" ? a.score : null,
    });
  }

  const opportunities: PsiOpportunity[] = [];
  for (const a of Object.values(audits) as Array<Record<string, unknown>>) {
    if (a.scoreDisplayMode !== "metricSavings") continue;
    const details = (a.details as Record<string, unknown> | undefined) ?? {};
    const overallSavingsMs =
      (details.overallSavingsMs as number | undefined) ?? 0;
    const overallSavingsBytes =
      (details.overallSavingsBytes as number | undefined) ?? 0;
    if (overallSavingsMs === 0 && overallSavingsBytes === 0) continue;
    opportunities.push({
      id: (a.id as string | undefined) ?? "unknown",
      title: (a.title as string | undefined) ?? "",
      description: (a.description as string | undefined) ?? "",
      savings: {
        ms: overallSavingsMs > 0 ? overallSavingsMs : undefined,
        bytes: overallSavingsBytes > 0 ? overallSavingsBytes : undefined,
      },
      score: typeof a.score === "number" ? a.score : null,
    });
  }
  opportunities.sort((a, b) => (b.savings.ms ?? 0) - (a.savings.ms ?? 0));

  return {
    url: requestedUrl,
    finalUrl,
    strategy,
    fetchTime,
    scores,
    metrics,
    opportunities,
    durationMs,
    error: null,
  };
}

function extractScore(c: unknown): PsiScore {
  if (!c || typeof c !== "object") return { score: null, title: "" };
  const o = c as Record<string, unknown>;
  const raw = typeof o.score === "number" ? o.score : null;
  return {
    score: raw === null ? null : Math.round(raw * 100),
    title: (o.title as string | undefined) ?? "",
  };
}
