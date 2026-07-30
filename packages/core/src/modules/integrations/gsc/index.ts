// integrations/gsc: Google Search Console data fetcher.
//
// The local runtime supplies a current vault-backed access token for the
// duration of the invocation. This leaf never reads token files or env secrets.

import { ConsoleLogger } from "../../../core/logger.js";
import { GscClient } from "../../../integrations/google/gsc.js";
import { buildComparablePerformanceWindows } from "../../../integrations/google/analytics-window.js";
import type {
  Module,
  ModuleContext,
  ModuleInput,
  ModuleOutput,
  ModuleSelfTestResult,
} from "../../types.js";

export const gscModule: Module = {
  id: "integrations:gsc",
  version: "0.9.0",
  displayName: "Google Search Console",
  category: "integration",
  description:
    "Fetch Google Search Console data for a site: per-URL clicks, impressions, CTR, position, top queries, and registered sitemaps. The local runtime injects a current vault-backed webmasters.readonly access token.",
  inputSchema: {
    type: "object",
    properties: {
      siteUrl: {
        type: "string",
        description:
          "GSC site URL (e.g. 'sc-domain:example.com' or 'https://example.com/').",
      },
      startDate: {
        type: "string",
        description:
          "ISO date YYYY-MM-DD. Defaults to the start of the latest complete 28-day window.",
      },
      endDate: {
        type: "string",
        description:
          "ISO date YYYY-MM-DD. Defaults to three days before the current UTC date.",
      },
    },
    required: ["siteUrl"],
  },
  outputSchema: {
    type: "object",
    properties: {
      siteUrl: { type: "string" },
      rows: { type: "array", description: "Per-URL GSC data." },
      queries: { type: "array", description: "Top queries." },
      sitemaps: { type: "array" },
    },
    required: ["rows"],
  },
  dependsOn: [],
  configKeys: ["MARKETINGOVO_GSC_SITE"],
  async invoke(input: ModuleInput, ctx: ModuleContext): Promise<ModuleOutput> {
    const logger = (ctx.logger ?? new ConsoleLogger()).child({ module: "gsc" });
    const accessToken =
      ctx.integrationCredentials?.["google-search-console"]?.accessToken;
    if (typeof accessToken !== "string" || !accessToken) {
      throw new Error(
        "GSC credential is unavailable; connect Search Console in the local vault",
      );
    }
    const token = { refresh: async () => ({ accessToken }) };
    const client = new GscClient(token, ctx.providerFetch);
    const window = buildComparablePerformanceWindows().current;
    const endDate = (input.endDate as string | undefined) ?? window.endDate;
    const startDate =
      (input.startDate as string | undefined) ?? window.startDate;
    const siteUrl = input.siteUrl as string;
    const [rows, queries] = await Promise.all([
      client.searchAnalytics({
        siteUrl,
        startDate,
        endDate,
        dimensions: ["page"],
      }),
      client.searchAnalytics({
        siteUrl,
        startDate,
        endDate,
        dimensions: ["query"],
        rowLimit: 25,
      }),
    ]);
    const data = { siteUrl, rows, queries };
    logger.info("gsc fetch complete", { site: input.siteUrl });
    ctx.signal.markStrong(`gsc: ${data.rows.length} rows`);
    return data as unknown as ModuleOutput;
  },
  async selfTest(): Promise<ModuleSelfTestResult> {
    return { ok: true, issues: [], checkedAt: new Date().toISOString() };
  },
};
