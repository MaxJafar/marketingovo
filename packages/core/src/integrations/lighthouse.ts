// Lighthouse integration. Wraps the `lighthouse` npm package so
// Marketingovo can attach a 0-100 score per category (performance,
// accessibility, best-practices, SEO) to any URL.
//
// Why not just call `lighthouse` directly?
//   1. We want a stable shape — categories as numbers, audits as
//      a flat list, top opportunities. The raw LHR is hundreds of
//      fields and changes between versions.
//   2. We share one Chrome instance across the whole crawl — much
//      faster than spawning one per URL.
//   3. We need to fail soft: if Chrome can't launch (e.g. inside
//      a restricted browser runtime), the crawl should still finish.
//
// `lighthouse` and `chrome-launcher` are runtime dependencies
// declared in package.json. If they're missing at runtime (e.g. the
// user is on a slimmer install), `isAvailable()` returns false and
// the orchestrator skips Lighthouse without crashing.

import type { ChildProcess } from "node:child_process";
import { resolveSafeEgressTarget } from "../core/safe-url.js";
import { createBrowserEgressProxy } from "../browser-egress-proxy.js";
import { resolveChromiumExecutablePath } from "../chromium-runtime.js";

export type LighthouseMode = "off" | "home" | "sample" | "all";

export interface LighthouseScore {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
}

export interface LighthouseAudit {
  id: string;
  title: string;
  score: number | null; // 0..1, null = informational
  displayValue: string | null;
  /** Estimated savings if fixed (ms for perf, bytes for network). */
  savings: { lcpMs?: number; clsMs?: number; bytes?: number };
}

export interface LighthouseReport {
  url: string;
  finalUrl: string;
  fetchTime: string;
  scores: LighthouseScore;
  /** Key audits, sorted by impact (lowest score first). */
  topAudits: LighthouseAudit[];
  /** Raw LHR categories for any consumer that wants them. */
  raw: unknown;
  durationMs: number;
  /** Populated on failure — orchestrator surfaces this in the report. */
  error: string | null;
}

let cachedLighthouse: typeof import("lighthouse") | null = null;
let cachedLauncher: typeof import("chrome-launcher") | null = null;
let loadAttempted = false;
let loadOk = false;

/**
 * Load the lighthouse + chrome-launcher modules. The Marketingovo
 * build emits ESM, so we use dynamic `import()` rather than
 * `require()`. The deps are also listed in package.json as
 * `optionalDependencies` so a missing Lighthouse install is
 * recoverable.
 */
async function loadDeps(): Promise<
  | {
      ok: true;
      lighthouse: typeof import("lighthouse");
      launcher: typeof import("chrome-launcher");
    }
  | { ok: false; reason: string }
> {
  if (cachedLighthouse && cachedLauncher) {
    return { ok: true, lighthouse: cachedLighthouse, launcher: cachedLauncher };
  }
  loadAttempted = true;
  try {
    // Lighthouse exports the runner as the default export, chrome-launcher
    // exports a named `launch` function. We treat both as untyped dynamic
    // imports — the public types in their packages are a moving target.
    const lh = (await import(
      "lighthouse" as string
    )) as unknown as typeof import("lighthouse");
    const launcher = (await import(
      "chrome-launcher" as string
    )) as unknown as typeof import("chrome-launcher");
    cachedLighthouse = lh;
    cachedLauncher = launcher;
    loadOk = true;
    return { ok: true, lighthouse: cachedLighthouse, launcher: cachedLauncher };
  } catch (err) {
    loadOk = false;
    return { ok: false, reason: (err as Error).message };
  }
}

/**
 * Synchronous availability check. Returns true only if a previous
 * async loadDeps() succeeded. If the check is too early (no
 * pre-warm happened), it returns false — callers that care should
 * call `await preloadDeps()` once at startup.
 */
export function isAvailable(): boolean {
  return loadOk && !!cachedLighthouse && !!cachedLauncher;
}

/** Eagerly load Lighthouse deps. Call this from CLI startup. */
export async function preloadDeps(): Promise<{ ok: boolean; reason?: string }> {
  const r = await loadDeps();
  if (r.ok) return { ok: true };
  return { ok: false, reason: r.reason };
}

export interface ChromeHandle {
  port: number;
  kill: () => Promise<void>;
  child: ChildProcess;
}

export const LIGHTHOUSE_CHROME_FLAGS = [
  "--headless=new",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-quic",
  "--disable-sync",
  "--disable-features=ServiceWorker",
  "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
  "--no-first-run",
  "--proxy-bypass-list=<-loopback>",
  "--webrtc-ip-handling-policy=disable_non_proxied_udp",
] as const;

export async function launchChrome(
  opts: {
    chromePath?: string;
    allowPrivate?: boolean;
    allowedPrivateHosts?: string[];
  } = {},
): Promise<ChromeHandle> {
  const deps = await loadDeps();
  if (!deps.ok) throw new Error(`lighthouse deps missing: ${deps.reason}`);
  const proxy = await createBrowserEgressProxy({
    allowPrivate: opts.allowPrivate ?? false,
    allowedPrivateHosts: opts.allowedPrivateHosts ?? [],
  });
  try {
    const chromePath = await resolveChromiumExecutablePath(opts.chromePath);
    const chrome = await deps.launcher.launch({
      // Never disable Chromium's sandbox for an untrusted audited page.
      chromeFlags: [...LIGHTHOUSE_CHROME_FLAGS, `--proxy-server=${proxy.url}`],
      ...(chromePath ? { chromePath } : {}),
    });
    return {
      port: chrome.port,
      kill: async () => {
        try {
          await chrome.kill();
        } finally {
          await proxy.close();
        }
      },
      // Native handle is opaque to us; we only use port + kill.
      child: chrome as unknown as ChildProcess,
    };
  } catch (error) {
    await proxy.close();
    throw error;
  }
}

export interface RunOptions {
  url: string;
  port: number;
  /** Explicit test/private-network opt-in. Public-only by default. */
  allowPrivate?: boolean;
  /** Lighthouse mode: "mobile" (default, 4G + slow CPU) or "desktop". */
  formFactor?: "mobile" | "desktop";
  /** Throttling preset (matches Lighthouse UI). */
  throttling?: "devtools" | "simulate" | "provided";
  /** Limit runtime; Lighthouse bails out beyond this. */
  maxWaitForLoadMs?: number;
}

export async function runLighthouse(
  opts: RunOptions,
): Promise<LighthouseReport> {
  // Lighthouse drives its own Chrome instance, so validate the top-level
  // target independently from the crawler before handing it to Chrome.
  await resolveSafeEgressTarget(opts.url, opts.allowPrivate ?? false);
  const deps = await loadDeps();
  if (!deps.ok) {
    return emptyReport(opts.url, `lighthouse deps missing: ${deps.reason}`);
  }
  const startedAt = Date.now();
  const lh = deps.lighthouse.default ?? deps.lighthouse;
  const result = await lh(opts.url, {
    port: opts.port,
    output: "json",
    logLevel: "error",
    onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    formFactor: opts.formFactor ?? "mobile",
    throttlingMethod: opts.throttling ?? "devtools",
    screenEmulation:
      opts.formFactor === "desktop"
        ? {
            mobile: false,
            width: 1350,
            height: 940,
            deviceScaleFactor: 1,
            disabled: false,
          }
        : {
            mobile: true,
            width: 412,
            height: 823,
            deviceScaleFactor: 1.75,
            disabled: false,
          },
    maxWaitForLoad: opts.maxWaitForLoadMs ?? 30000,
  });
  const lhr = (result as { lhr: unknown }).lhr as {
    finalUrl?: string;
    fetchTime?: string;
    categories?: Record<string, { score?: number | null }>;
    audits?: Record<
      string,
      {
        id: string;
        title: string;
        score: number | null;
        displayValue?: string | null;
        details?: {
          overallSavingsMs?: number;
          overallSavingsBytes?: number;
          type?: string;
          items?: Array<{ lcpMs?: number; clsScore?: number }>;
        };
      }
    >;
  };
  const scores: LighthouseScore = {
    performance: scoreOf(lhr.categories?.performance),
    accessibility: scoreOf(lhr.categories?.accessibility),
    bestPractices: scoreOf(lhr.categories?.["best-practices"]),
    seo: scoreOf(lhr.categories?.seo),
  };
  const audits = lhr.audits ?? {};
  const topAudits: LighthouseAudit[] = Object.values(audits)
    .filter(
      (a) =>
        a && typeof a.score === "number" && a.score < 0.9 && a.score !== null,
    )
    .map((a) => {
      const details = a.details ?? {};
      const savings: LighthouseAudit["savings"] = {};
      if (typeof details.overallSavingsMs === "number") {
        // Heuristic: if audit id starts with lcp/cls, attribute; otherwise generic.
        if (
          a.id.includes("lcp") ||
          a.id.includes("render-blocking") ||
          a.id.includes("unused-css") ||
          a.id.includes("unused-javascript") ||
          a.id.includes("text-compression")
        ) {
          savings.lcpMs = details.overallSavingsMs;
        } else if (a.id.includes("cls")) {
          savings.clsMs = details.overallSavingsMs;
        }
      }
      if (typeof details.overallSavingsBytes === "number") {
        savings.bytes = details.overallSavingsBytes;
      }
      return {
        id: a.id,
        title: a.title,
        score: a.score,
        displayValue: a.displayValue ?? null,
        savings,
      };
    })
    .sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
    .slice(0, 15);
  return {
    url: opts.url,
    finalUrl: lhr.finalUrl ?? opts.url,
    fetchTime: lhr.fetchTime ?? new Date().toISOString(),
    scores,
    topAudits,
    raw: lhr,
    durationMs: Date.now() - startedAt,
    error: null,
  };
}

function scoreOf(cat: { score?: number | null } | undefined): number | null {
  if (!cat || cat.score === null || cat.score === undefined) return null;
  return Math.round(cat.score * 100);
}

function emptyReport(url: string, error: string): LighthouseReport {
  return {
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
    error,
  };
}

/**
 * Pick which URLs to score. Strategy:
 *  - "home": only the start URL
 *  - "sample": start URL + up to N random non-home pages
 *  - "all": every URL
 *  - "off": empty
 */
export function pickUrlsForLighthouse(
  mode: LighthouseMode,
  allUrls: string[],
  startUrl: string,
  sampleSize = 5,
  rng: () => number = Math.random,
): string[] {
  if (mode === "off" || allUrls.length === 0) return [];
  if (mode === "home") return [startUrl];
  if (mode === "all") return allUrls;
  // sample
  const home = allUrls.find((u) => u === startUrl) ?? startUrl;
  const others = allUrls.filter((u) => u !== home);
  // Fisher-Yates shuffle (partial).
  for (let i = others.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [others[i], others[j]] = [others[j]!, others[i]!];
  }
  return [home, ...others.slice(0, sampleSize - 1)];
}
