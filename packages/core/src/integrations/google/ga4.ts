// Google Analytics 4 Data API. Per-URL traffic + engagement. We
// accept that GA4 tokens may not be present and degrade gracefully
// (caller checks `isConfigured` first).

import type { GoogleAccessTokenManager } from "./oauth.js";
import { safeGoogleAnalyticsFetch } from "@agentseoapp/integrations";

const API = "https://analyticsdata.googleapis.com/v1beta";
const MAX_PAGE_ROWS = 100_000;
const MAX_TOTAL_ROWS = 1_000_000;

function boundedPositiveInt(
  value: number | undefined,
  fallback: number,
  max: number,
): number {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return fallback;
  return Math.max(1, Math.min(Math.trunc(value as number), max));
}

export interface Ga4Row {
  page: string;
  sessions: number;
  pageViews: number;
  engagementRate: number;
  bounceRate: number;
  avgSessionDuration: number;
  keyEvents: number;
}

export class Ga4Client {
  private readonly propertyId: string;

  constructor(
    private readonly token: GoogleAccessTokenManager,
    propertyId: string,
    private readonly providerFetch: typeof fetch = safeGoogleAnalyticsFetch,
  ) {
    this.propertyId = propertyId.trim();
  }

  isConfigured(): boolean {
    return /^[1-9]\d*$/.test(this.propertyId);
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const c = await this.token.refresh();
    return { authorization: `Bearer ${c.accessToken}` };
  }

  /** Per-pagePath traffic + engagement for the given range. */
  async perPage(opts: {
    startDate: string;
    endDate: string;
    limit?: number;
    pageSize?: number;
  }): Promise<Ga4Row[]> {
    if (!this.isConfigured()) {
      throw new Error(
        "invalid GA4 property id; expected a positive numeric id",
      );
    }
    // Paginate the complete provider result by default. A silent 1,000-row
    // fallback made larger properties look complete even though the API had
    // more pages available. Callers can still request a smaller explicit
    // limit when they intentionally want a sample.
    const totalLimit = boundedPositiveInt(
      opts.limit,
      MAX_TOTAL_ROWS,
      MAX_TOTAL_ROWS,
    );
    const pageSize = boundedPositiveInt(
      opts.pageSize,
      MAX_PAGE_ROWS,
      MAX_PAGE_ROWS,
    );
    const rows: Ga4Row[] = [];
    let offset = 0;
    let knownRowCount: number | null = null;

    while (
      rows.length < totalLimit &&
      (knownRowCount === null || offset < knownRowCount)
    ) {
      const batchLimit = Math.min(pageSize, totalLimit - rows.length);
      const body = {
        dateRanges: [{ startDate: opts.startDate, endDate: opts.endDate }],
        dimensions: [{ name: "pagePath" }],
        // AGENTseo's GA4 metrics are explicitly organic. Filtering at the
        // provider boundary prevents sessions and key events from paid,
        // direct, referral, and other channels being mislabeled downstream.
        dimensionFilter: {
          filter: {
            fieldName: "sessionDefaultChannelGroup",
            stringFilter: {
              matchType: "EXACT",
              value: "Organic Search",
              caseSensitive: true,
            },
          },
        },
        metrics: [
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "engagementRate" },
          { name: "bounceRate" },
          { name: "averageSessionDuration" },
          { name: "keyEvents" },
        ],
        limit: String(batchLimit),
        offset: String(offset),
      };
      const headers = await this.authHeaders();
      const res = await this.providerFetch(
        `${API}/properties/${encodeURIComponent(this.propertyId)}:runReport`,
        {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify(body),
          redirect: "error",
        },
      );
      if (!res.ok) {
        throw new Error(
          `GA4 runReport failed: ${res.status} ${(await res.text()).slice(0, 200)}`,
        );
      }
      const json = (await res.json()) as {
        rowCount?: number;
        rows?: Array<{
          dimensionValues?: Array<{ value?: string }>;
          metricValues?: Array<{ value?: string }>;
        }>;
      };
      if (Number.isFinite(json.rowCount)) knownRowCount = Number(json.rowCount);
      const batch = (json.rows ?? []).map(rowFromApi);
      rows.push(...batch.slice(0, totalLimit - rows.length));
      if (batch.length === 0) break;
      offset += batch.length;
      if (knownRowCount === null && batch.length < batchLimit) break;
    }
    return rows;
  }
}

function rowFromApi(r: {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
}): Ga4Row {
  const dims = r.dimensionValues ?? [];
  const mets = r.metricValues ?? [];
  return {
    page: dims[0]?.value ?? "",
    sessions: Number(mets[0]?.value ?? 0),
    pageViews: Number(mets[1]?.value ?? 0),
    engagementRate: Number(mets[2]?.value ?? 0),
    bounceRate: Number(mets[3]?.value ?? 0),
    avgSessionDuration: Number(mets[4]?.value ?? 0),
    keyEvents: Number(mets[5]?.value ?? 0),
  };
}
