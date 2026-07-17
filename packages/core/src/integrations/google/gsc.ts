// Google Search Console data API (webmasters/v3). Per-URL
// searchAnalytics + sitemaps + urlInspection. We deliberately keep
// this thin: a few well-typed methods, no SDK, no streaming.
//
// Reference: https://developers.google.com/webmasters/api/v3/searchanalytics

import type { GoogleAccessTokenManager } from "./oauth.js";
import { safeGoogleSearchConsoleFetch } from "@agentseoapp/integrations";

const API = "https://www.googleapis.com/webmasters/v3";
const MAX_PAGE_ROWS = 25_000;
const MAX_TOTAL_ROWS = 250_000;

function boundedPositiveInt(
  value: number | undefined,
  fallback: number,
  max: number,
): number {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return fallback;
  return Math.max(1, Math.min(Math.trunc(value as number), max));
}

export interface GscRow {
  /** ISO date YYYY-MM-DD. */
  date: string;
  query: string;
  page: string;
  country: string;
  device: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscMetrics {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscAggregate extends GscMetrics {
  page: string;
}

export interface GscQueryAggregate extends GscMetrics {
  query: string;
}

export interface GscQueryPageAggregate extends GscMetrics {
  query: string;
  page: string;
}

export interface GscUrlInspection {
  url: string;
  indexStatus: string;
  lastCrawlTime: string | null;
  mobileUsability: string;
  richResults: number;
  coverageState: string;
}

export class GscClient {
  constructor(
    private readonly token: GoogleAccessTokenManager,
    private readonly providerFetch: typeof fetch = safeGoogleSearchConsoleFetch,
  ) {}

  private async authHeaders(): Promise<Record<string, string>> {
    const c = await this.token.refresh();
    return { authorization: `Bearer ${c.accessToken}` };
  }

  /** Run searchAnalytics.query with optional dimensions. */
  async searchAnalytics(opts: {
    siteUrl: string;
    startDate: string;
    endDate: string;
    dimensions?: Array<"date" | "query" | "page" | "country" | "device">;
    /** Total rows requested across pages. */
    rowLimit?: number;
    /** Per-request size, capped at Google's 25k maximum. */
    pageSize?: number;
  }): Promise<GscRow[]> {
    const dimensions = opts.dimensions ?? ["date", "query", "page"];
    const totalLimit = boundedPositiveInt(
      opts.rowLimit,
      MAX_PAGE_ROWS,
      MAX_TOTAL_ROWS,
    );
    const pageSize = boundedPositiveInt(
      opts.pageSize,
      MAX_PAGE_ROWS,
      MAX_PAGE_ROWS,
    );
    const rows: GscRow[] = [];
    let startRow = 0;

    while (rows.length < totalLimit) {
      const batchLimit = Math.min(pageSize, totalLimit - rows.length);
      const body = {
        startDate: opts.startDate,
        endDate: opts.endDate,
        // Search Console expects lowercase dimension identifiers.
        dimensions,
        rowLimit: batchLimit,
        startRow,
      };
      const headers = await this.authHeaders();
      const res = await this.providerFetch(
        `${API}/sites/${encodeURIComponent(opts.siteUrl)}/searchAnalytics/query`,
        {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify(body),
          redirect: "error",
        },
      );
      if (!res.ok) {
        throw new Error(
          `GSC searchAnalytics failed: ${res.status} ${(await res.text()).slice(0, 200)}`,
        );
      }
      const json = (await res.json()) as {
        rows?: Array<Record<string, unknown>>;
      };
      const batch = (json.rows ?? []).map((row) => rowFromApi(row, dimensions));
      rows.push(...batch.slice(0, totalLimit - rows.length));
      if (batch.length === 0 || batch.length < batchLimit) break;
      startRow += batch.length;
    }
    return rows;
  }

  /**
   * Aggregate by page (sum of clicks/impressions, weighted CTR, mean
   * position). One row per URL — what the report cares about.
   */
  async perPage(opts: {
    siteUrl: string;
    startDate: string;
    endDate: string;
    /** Total page rows retained across Google's 25k response pages. */
    rowLimit?: number;
    pageSize?: number;
  }): Promise<GscAggregate[]> {
    const rows = await this.searchAnalytics({
      ...opts,
      dimensions: ["page"],
      rowLimit: opts.rowLimit ?? MAX_TOTAL_ROWS,
      pageSize: opts.pageSize,
    });
    const byPage = new Map<
      string,
      { clicks: number; impr: number; posSum: number; n: number }
    >();
    for (const r of rows) {
      const e = byPage.get(r.page) ?? { clicks: 0, impr: 0, posSum: 0, n: 0 };
      e.clicks += r.clicks;
      e.impr += r.impressions;
      e.posSum += r.position;
      e.n += 1;
      byPage.set(r.page, e);
    }
    return Array.from(byPage.entries())
      .map(([page, e]) => ({
        page,
        clicks: e.clicks,
        impressions: e.impr,
        ctr: e.impr > 0 ? e.clicks / e.impr : 0,
        position: e.n > 0 ? e.posSum / e.n : 0,
      }))
      .sort(
        (a, b) => b.impressions - a.impressions || a.page.localeCompare(b.page),
      );
  }

  /** Top queries across the whole site (no page breakdown). */
  async topQueries(opts: {
    siteUrl: string;
    startDate: string;
    endDate: string;
    rowLimit?: number;
  }): Promise<GscQueryAggregate[]> {
    const limit = Math.max(1, opts.rowLimit ?? 25);
    const rows = await this.searchAnalytics({
      ...opts,
      dimensions: ["query"],
      rowLimit: limit,
    });
    return rows
      .map((r) => ({
        query: r.query,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      }))
      .sort(
        (a, b) =>
          b.clicks - a.clicks ||
          b.impressions - a.impressions ||
          a.query.localeCompare(b.query),
      )
      .slice(0, limit);
  }

  /**
   * Query + canonical page rows used for affected-URL cohort analysis.
   * Unlike `perPage`, these rows are intentionally not aggregated further:
   * the query/page pair is the evidence that a comparison workflow needs.
   */
  async queryPages(opts: {
    siteUrl: string;
    startDate: string;
    endDate: string;
    /** Total rows retained across Google's 25k response pages. */
    rowLimit?: number;
    pageSize?: number;
  }): Promise<GscQueryPageAggregate[]> {
    const rows = await this.searchAnalytics({
      ...opts,
      dimensions: ["query", "page"],
      rowLimit: opts.rowLimit ?? MAX_TOTAL_ROWS,
      pageSize: opts.pageSize,
    });
    return rows
      .map((row) => ({
        query: row.query,
        page: row.page,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      }))
      .sort(
        (a, b) =>
          b.clicks - a.clicks ||
          b.impressions - a.impressions ||
          a.query.localeCompare(b.query) ||
          a.page.localeCompare(b.page),
      );
  }

  /** List sitemaps. */
  async sitemaps(siteUrl: string): Promise<
    Array<{
      path: string;
      lastSubmitted: string;
      lastDownloaded: string;
      isPending: boolean;
      warnings: number;
      errors: number;
    }>
  > {
    const headers = await this.authHeaders();
    const res = await this.providerFetch(
      `${API}/sites/${encodeURIComponent(siteUrl)}/sitemaps`,
      { headers, redirect: "error" },
    );
    if (!res.ok) {
      throw new Error(
        `GSC sitemaps failed: ${res.status} ${(await res.text()).slice(0, 200)}`,
      );
    }
    const json = (await res.json()) as {
      sitemap?: Array<Record<string, unknown>>;
    };
    return (json.sitemap ?? []).map((s) => ({
      path: String(s.path ?? ""),
      lastSubmitted: String(s.lastSubmitted ?? ""),
      lastDownloaded: String(s.lastDownloaded ?? ""),
      isPending: Boolean(s.isPending),
      warnings: Number(s.warnings ?? 0),
      errors: Number(s.errors ?? 0),
    }));
  }

  /** URL Inspection: get the Google-side view of a single URL. */
  async urlInspection(siteUrl: string, url: string): Promise<GscUrlInspection> {
    const headers = await this.authHeaders();
    const res = await this.providerFetch(`${API}/urlInspection/index:inspect`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ inspectionUrl: url, siteUrl }),
      redirect: "error",
    });
    if (!res.ok) {
      throw new Error(
        `GSC urlInspection failed: ${res.status} ${(await res.text()).slice(0, 200)}`,
      );
    }
    const json = (await res.json()) as {
      inspectionResult?: Record<string, unknown>;
    };
    const r = json.inspectionResult ?? {};
    const link = (r.indexStatusResult as Record<string, unknown>) ?? {};
    const mob = (r.mobileUsabilityResult as Record<string, unknown>) ?? {};
    const rich = (r.richResultsResult as Record<string, unknown>) ?? {};
    return {
      url,
      indexStatus: String(link.verdict ?? "UNKNOWN"),
      lastCrawlTime: String(link.lastCrawlTime ?? "") || null,
      mobileUsability: String(mob.verdict ?? "UNKNOWN"),
      richResults: Array.isArray(rich.detectedItems)
        ? rich.detectedItems.length
        : 0,
      coverageState: String(link.coverageState ?? ""),
    };
  }
}

function rowFromApi(
  r: Record<string, unknown>,
  dimensions: Array<"date" | "query" | "page" | "country" | "device">,
): GscRow {
  const keys = r.keys as string[] | undefined;
  const out: GscRow = {
    date: "",
    query: "",
    page: "",
    country: "",
    device: "",
    clicks: Number(r.clicks ?? 0),
    impressions: Number(r.impressions ?? 0),
    ctr: Number(r.ctr ?? 0),
    position: Number(r.position ?? 0),
  };
  if (Array.isArray(keys)) {
    for (let i = 0; i < dimensions.length; i += 1) {
      const dim = dimensions[i];
      const value = keys[i] ?? "";
      if (dim === "date") out.date = value;
      else if (dim === "query") out.query = value;
      else if (dim === "page") out.page = value;
      else if (dim === "country") out.country = value;
      else if (dim === "device") out.device = value;
    }
  }
  return out;
}
