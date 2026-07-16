// integrations/trends: Google Trends interest-over-time fetcher.
//
// Category: integration. Replaces: Google Trends UI.
//
// Wraps src/integrations/trends.ts. Uses the google-trends-api
// package. Soft-fails if the package isn't installed.

import { ConsoleLogger } from "../../../core/logger.js";
import {
  trendsInterest,
  isAvailable as trendsAvailable,
  type TrendsOptions,
  type TrendsReport,
} from "../../../integrations/trends.js";
import type {
  Module,
  ModuleContext,
  ModuleInput,
  ModuleOutput,
  ModuleSelfTestResult,
} from "../../types.js";

export const trendsModule: Module = {
  id: "integrations:trends",
  version: "0.9.0",
  displayName: "Google Trends",
  category: "integration",
  description:
    "Google Trends interest-over-time for one or more keywords. Returns momentum (q-o-q slope), verdict (rising/stable/falling), related queries/topics.",
  inputSchema: {
    type: "object",
    properties: {
      keywords: {
        type: "array",
        items: { type: "string" },
        description:
          "1-5 keywords to compare. Default: GOLEMSEO_TRENDS_KEYWORDS env (comma-separated).",
      },
      timeframe: {
        type: "string",
        default: "today 3-m",
        description: "Trends timeframe string.",
      },
      geo: {
        type: "string",
        default: "",
        description: "Geo (default: worldwide).",
      },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    properties: {
      points: { type: "array", description: "Trends data points." },
      verdict: {
        type: "string",
        enum: ["rising", "stable", "falling", "unknown"],
      },
    },
  },
  dependsOn: [],
  configKeys: ["GOLEMSEO_TRENDS_KEYWORDS"],
  async invoke(input: ModuleInput, ctx: ModuleContext): Promise<ModuleOutput> {
    const logger = (ctx.logger ?? new ConsoleLogger()).child({
      module: "trends",
    });
    if (!trendsAvailable()) {
      throw new Error(
        "google-trends-api package not installed; run `npm install`",
      );
    }
    const keywords = (input.keywords as string[] | undefined) ?? [];
    if (keywords.length === 0) {
      throw new Error(
        "trends module requires keywords in input or GOLEMSEO_TRENDS_KEYWORDS env",
      );
    }
    const timeframeMap: Record<string, number> = {
      "today 1-m": 30,
      "today 3-m": 90,
      "today 12-m": 365,
    };
    const days = timeframeMap[(input.timeframe as string) ?? "today 3-m"] ?? 90;
    const reports: TrendsReport[] = [];
    for (const kw of keywords) {
      const opts: TrendsOptions = {
        keyword: kw,
        days,
        geo: (input.geo as string | undefined) ?? "",
      };
      reports.push(await trendsInterest(opts));
    }
    logger.info("trends fetch complete", { keywords: keywords.length });
    ctx.signal.markStrong(`trends: ${reports.length} reports`);
    return { reports } as unknown as ModuleOutput;
  },
  async selfTest(): Promise<ModuleSelfTestResult> {
    if (!trendsAvailable()) {
      return {
        ok: false,
        issues: ["google-trends-api package not installed"],
        checkedAt: new Date().toISOString(),
      };
    }
    return { ok: true, issues: [], checkedAt: new Date().toISOString() };
  },
};
