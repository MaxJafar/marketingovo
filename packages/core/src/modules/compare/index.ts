// compare module: side-by-side SEO audit of 2-3 sites.
//
// Category: research. Replaces: Semrush Competitive Research, Ahrefs
// Competing Domains, SpyFu competitor analysis.
//
// Wraps src/compare.ts which already produces HTML/MD/JSON reports
// with category leaders highlighted. Output schema matches what
// compare_sites tool in plugin.json has been returning.

import { ConsoleLogger } from "../../core/logger.js";
import { MAX_URLS_CONFIGURATION_BOUNDARY } from "../../core/limits.js";
import {
  compareSites,
  type CompareOptions,
  type ComparisonResult,
} from "../../compare.js";
import type {
  Module,
  ModuleContext,
  ModuleInput,
  ModuleOutput,
  ModuleSelfTestResult,
} from "../types.js";

export const compareModule: Module = {
  id: "compare",
  version: "0.9.0",
  displayName: "Competitive Compare",
  category: "research",
  description:
    "Side-by-side SEO audit of 2-3 sites: same checks as crawl_site, plus category leaders highlighted in HTML/MD/JSON output. Backed by src/compare.ts.",
  inputSchema: {
    type: "object",
    properties: {
      urls: {
        type: "array",
        items: { type: "string" },
        // minItems/maxItems are documentation; full JSON Schema
        // validation is deferred to Sprint 15 (enterprise hardening).
        minItems: 2,
        maxItems: 3,
        description: "2-3 starting URLs to crawl and compare.",
      },
      maxUrls: {
        type: "number",
        default: 30,
        minimum: 1,
        maximum: MAX_URLS_CONFIGURATION_BOUNDARY,
        description: "User-selected per-site crawl scope.",
      },
      maxRuntimeMs: {
        type: "number",
        default: 60_000,
        minimum: 10_000,
        maximum: 600_000,
      },
      renderMode: { type: "string", enum: ["static", "js"], default: "static" },
      lighthouse: { type: "string", enum: ["off", "home"], default: "off" },
    },
    required: ["urls"],
  },
  outputSchema: {
    type: "object",
    properties: {
      sites: {
        type: "array",
        description: "Per-site summaries (one entry per URL).",
      },
      leaders: {
        type: "object",
        description: "Per-category winning site.",
      },
    },
    required: ["sites"],
  },
  dependsOn: [],
  configKeys: [
    "MARKETINGOVO_RENDER",
    "MARKETINGOVO_LIGHTHOUSE",
    "MARKETINGOVO_MAX_URLS",
    "MARKETINGOVO_MAX_RUNTIME_MS",
  ],
  async invoke(input: ModuleInput, ctx: ModuleContext): Promise<ModuleOutput> {
    const logger = (ctx.logger ?? new ConsoleLogger()).child({
      module: "compare",
    });
    const opts: CompareOptions = {
      urls: (input.urls as string[]) ?? [],
      renderMode: (input.renderMode as "static" | "js" | undefined) ?? "static",
      maxUrls: (input.maxUrls as number | undefined) ?? 30,
      maxRuntimeMs: (input.maxRuntimeMs as number | undefined) ?? 60_000,
      lighthouse: (input.lighthouse as "off" | "home" | undefined) ?? "off",
      projectRoot: ctx.projectRoot,
    };
    if (opts.urls.length < 2) {
      throw new Error("compare module requires at least 2 urls");
    }
    logger.info("compare start", {
      urls: opts.urls.length,
      maxUrls: opts.maxUrls,
    });
    const result: ComparisonResult = await compareSites(opts);
    if (result.sites.length < opts.urls.length) {
      ctx.signal.markWeak(
        `compare got ${result.sites.length}/${opts.urls.length} sites`,
      );
    } else {
      ctx.signal.markStrong(`compare complete: ${result.sites.length} sites`);
    }
    return result as unknown as ModuleOutput;
  },
  async selfTest(): Promise<ModuleSelfTestResult> {
    return { ok: true, issues: [], checkedAt: new Date().toISOString() };
  },
};
