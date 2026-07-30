// integrations/ga4: Google Analytics 4 data fetcher.
//
// The local runtime supplies a current vault-backed access token for the
// duration of the invocation. This leaf never reads token files or env secrets.

import { ConsoleLogger } from "../../../core/logger.js";
import { Ga4Client } from "../../../integrations/google/ga4.js";
import { buildComparablePerformanceWindows } from "../../../integrations/google/analytics-window.js";
import type {
  Module,
  ModuleContext,
  ModuleInput,
  ModuleOutput,
  ModuleSelfTestResult,
} from "../../types.js";

export const ga4Module: Module = {
  id: "integrations:ga4",
  version: "0.9.0",
  displayName: "Google Analytics 4",
  category: "integration",
  description:
    "Fetch Google Analytics 4 data for a property: per-pagePath sessions, page views, engagement rate, bounce rate, average session duration, and key events. The local runtime injects a current vault-backed analytics.readonly access token.",
  inputSchema: {
    type: "object",
    properties: {
      propertyId: {
        type: "string",
        description: "GA4 property id (numeric, e.g. '532488967').",
      },
      startDate: { type: "string" },
      endDate: { type: "string" },
    },
    required: ["propertyId"],
  },
  outputSchema: {
    type: "object",
    properties: {
      rows: { type: "array", description: "Per-pagePath GA4 data." },
    },
    required: ["rows"],
  },
  dependsOn: [],
  configKeys: ["MARKETINGOVO_GA4_PROPERTY"],
  async invoke(input: ModuleInput, ctx: ModuleContext): Promise<ModuleOutput> {
    const logger = (ctx.logger ?? new ConsoleLogger()).child({ module: "ga4" });
    const accessToken =
      ctx.integrationCredentials?.["google-analytics-4"]?.accessToken;
    if (typeof accessToken !== "string" || !accessToken) {
      throw new Error(
        "GA4 credential is unavailable; connect GA4 in the local vault",
      );
    }
    const token = { refresh: async () => ({ accessToken }) };
    const propertyId = input.propertyId as string;
    const client = new Ga4Client(token, propertyId, ctx.providerFetch);
    const window = buildComparablePerformanceWindows().current;
    const endDate = (input.endDate as string | undefined) ?? window.endDate;
    const startDate =
      (input.startDate as string | undefined) ?? window.startDate;
    const rows = await client.perPage({ startDate, endDate });
    const data = { propertyId, rows };
    logger.info("ga4 fetch complete", { property: input.propertyId });
    ctx.signal.markStrong(`ga4: ${data.rows.length} rows`);
    return data as unknown as ModuleOutput;
  },
  async selfTest(): Promise<ModuleSelfTestResult> {
    return { ok: true, issues: [], checkedAt: new Date().toISOString() };
  },
};
