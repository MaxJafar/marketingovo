// "People Also Ask" (PAA) integration. Composes three real
// backends so a single failure (rate limit, captcha, missing
// credentials) doesn't kill the signal:
//
//   1. SERPAPI  — paid, official Google search-API proxy. Used
//      when vault-backed SerpAPI credentials are supplied. Returns the deepest set
//      of questions because it supports PAA depth recursion
//      via google_related_questions. Free tier: 100 searches
//      per month on signup.
//   2. DATAFORSEO  — paid, official SERP. Used when
//      vault-backed DataForSEO credentials are supplied. One
//      task = one SERP page (no PAA depth recursion by
//      default). Returns 0–4 questions per task.
//   3. CUSTOM SCRAPER  — free, key-less. Hits
//      https://www.google.com/search?q=<q> with a desktop
//      Chrome User-Agent and parses the HTML with linkedom.
//      Always tried last as the universal fallback. Returns
//      0-depth PAA (no recursion). Fragile to layout
//      changes — we tolerate that and return [] on miss.
//
// The module is intentionally permissive: every backend
// failure is surfaced in the result, never thrown. The caller
// (keyword-research) decides which result to trust based on
// `items.length` and `error`.
//
// Reference URLs (these are public endpoints we are not
// bypassing auth on):
//   SerpApi:   https://serpapi.com/search.json?engine=google&q=<q>
//   DataForSEO: https://api.dataforseo.com/v3/serp/google/organic/live/advanced
//   Google:    https://www.google.com/search?q=<q>&hl=en&gl=us&num=20

import { parseHTML } from "linkedom";
import { safeResearchProviderFetch } from "./research-provider-fetch.js";
import {
  extractDataForSeoCost,
  providerUsage,
  type ResearchProviderPayload,
  type ResearchProviderUsage,
} from "./provider-usage.js";

export type PaaBackend = "serpapi" | "dataforseo" | "custom";

export interface PaaResult {
  /** Which backend produced this result. */
  backend: PaaBackend;
  /** The questions, in display order. May be empty. */
  items: string[];
  /** Set on failure (timeout, captcha, non-2xx, parse error). */
  error: string | null;
  /** Whether the backend requires paid credentials. */
  requiresKey: boolean;
  durationMs: number;
  /** Provider economics for transparent BYOK accounting. */
  usage: ResearchProviderUsage;
}

export interface PaaOptions {
  /** Per-backend timeout in ms. Default 5_000. */
  timeoutMs?: number;
  /** Limit which backends to try. Default: all three. */
  backends?: readonly PaaBackend[];
  /** Override the fetch implementation (for tests). */
  fetchImpl?: typeof fetch;
  /** Per-run vault credentials. Active code never reads secret environment values. */
  credentials?: ResearchProviderCredentials;
}

export interface ResearchProviderCredentials {
  serpapi?: { apiKey: string; gl?: string; hl?: string };
  dataforseo?: {
    login: string;
    password: string;
    locationCode?: number;
    languageCode?: string;
  };
}

const ALL_BACKENDS: readonly PaaBackend[] = ["serpapi", "dataforseo", "custom"];

export function isAvailable(): boolean {
  return typeof fetch === "function";
}

/** Which backends are usable right now (creds + fetch)? */
export function availableBackends(
  credentials?: ResearchProviderCredentials,
): PaaBackend[] {
  const out: PaaBackend[] = [];
  if (hasSerpApiKey(credentials)) out.push("serpapi");
  if (hasDataForSeoCreds(credentials)) out.push("dataforseo");
  if (isAvailable()) out.push("custom");
  return out;
}

function hasSerpApiKey(credentials?: ResearchProviderCredentials): boolean {
  return Boolean(credentials?.serpapi?.apiKey);
}

function hasDataForSeoCreds(
  credentials?: ResearchProviderCredentials,
): boolean {
  return Boolean(
    credentials?.dataforseo?.login && credentials.dataforseo.password,
  );
}

/**
 * Run all configured PAA backends in parallel. Each backend
 * is independent — one failure does not affect the others.
 */
export async function paaAll(
  query: string,
  opts: PaaOptions = {},
): Promise<PaaResult[]> {
  const backends =
    opts.backends && opts.backends.length > 0 ? opts.backends : ALL_BACKENDS;
  const fetcher = opts.fetchImpl ?? safeResearchProviderFetch;
  const tasks = backends.map((b) =>
    paaOne(query, b, opts.timeoutMs ?? 5_000, fetcher, opts.credentials),
  );
  return Promise.all(tasks);
}

/**
 * Return the first non-empty result, or the result of the
 * highest-priority backend. Order is preserved: serpapi >
 * dataforseo > custom.
 */
export async function paaBest(
  query: string,
  opts: PaaOptions = {},
): Promise<PaaResult> {
  const all = await paaAll(query, opts);
  const withItems = all.find((r) => r.items.length > 0);
  return withItems ?? all[0] ?? emptyResult("custom", 0);
}

export async function paaOne(
  query: string,
  backend: PaaBackend,
  timeoutMs = 5_000,
  fetchImpl: typeof fetch = safeResearchProviderFetch,
  credentials?: ResearchProviderCredentials,
): Promise<PaaResult> {
  const started = Date.now();
  if (!query || !query.trim()) {
    return {
      backend,
      items: [],
      error: "empty query",
      requiresKey: backend !== "custom",
      durationMs: 0,
      usage: providerUsage(backend === "custom" ? "free" : "billable", false),
    };
  }
  if (backend === "serpapi" && !hasSerpApiKey(credentials)) {
    return {
      backend,
      items: [],
      error: "SerpAPI credential is not connected",
      requiresKey: true,
      durationMs: 0,
      usage: providerUsage("billable", false),
    };
  }
  if (backend === "dataforseo" && !hasDataForSeoCreds(credentials)) {
    return {
      backend,
      items: [],
      error: "DataForSEO credential is not connected",
      requiresKey: true,
      durationMs: 0,
      usage: providerUsage("billable", false),
    };
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    let result: ResearchProviderPayload<string[]>;
    switch (backend) {
      case "serpapi":
        result = await fetchSerpApiPaa(
          query,
          ac.signal,
          fetchImpl,
          credentials,
        );
        break;
      case "dataforseo":
        result = await fetchDataForSeoPaa(
          query,
          ac.signal,
          fetchImpl,
          credentials,
        );
        break;
      case "custom":
        result = await fetchCustomScraperPaa(query, ac.signal, fetchImpl);
        break;
      default:
        result = { value: [], actualCostUsd: null };
    }
    return {
      backend,
      items: result.value,
      error: null,
      requiresKey: backend !== "custom",
      durationMs: Date.now() - started,
      usage: providerUsage(
        backend === "custom" ? "free" : "billable",
        true,
        result.actualCostUsd,
      ),
    };
  } catch (err) {
    return {
      backend,
      items: [],
      error: (err as Error).message,
      requiresKey: backend !== "custom",
      durationMs: Date.now() - started,
      usage: providerUsage(backend === "custom" ? "free" : "billable", true),
    };
  } finally {
    clearTimeout(timer);
  }
}

function emptyResult(backend: PaaBackend, durationMs: number): PaaResult {
  return {
    backend,
    items: [],
    error: "no backends configured",
    requiresKey: false,
    durationMs,
    usage: providerUsage(backend === "custom" ? "free" : "billable", false),
  };
}

// ---- SerpApi ----
//
// Endpoint: https://serpapi.com/search.json?engine=google&q=<q>
// Response shape: { related_questions: [{ question, next_page_token }, ...] }
// For depth: GET https://serpapi.com/search.json?engine=google_related_questions&next_page_token=<token>
// We do shallow (depth 0) by default to keep latency low. The
// caller can pass a higher depth via env SERPAPI_PAA_DEPTH
// (capped at 2 to keep the budget under control).
async function fetchSerpApiPaa(
  query: string,
  signal: AbortSignal,
  fetchImpl: typeof fetch,
  credentials?: ResearchProviderCredentials,
): Promise<ResearchProviderPayload<string[]>> {
  const params = new URLSearchParams({
    engine: "google",
    q: query,
    api_key: credentials?.serpapi?.apiKey ?? "",
    gl: credentials?.serpapi?.gl ?? process.env["SERPAPI_GL"] ?? "us",
    hl: credentials?.serpapi?.hl ?? process.env["SERPAPI_HL"] ?? "en",
  });
  const url = `https://serpapi.com/search.json?${params.toString()}`;
  const res = await fetchImpl(url, {
    method: "GET",
    signal,
    redirect: "error",
  });
  if (!res.ok) throw new Error(`serpapi HTTP ${res.status}`);
  const data = (await res.json()) as {
    related_questions?: Array<{ question?: string; next_page_token?: string }>;
  };
  const questions: string[] = [];
  for (const rq of data.related_questions ?? []) {
    if (typeof rq.question === "string" && rq.question.trim())
      questions.push(rq.question.trim());
  }
  return { value: questions, actualCostUsd: null };
}

// ---- DataForSEO ----
//
// Endpoint: POST https://api.dataforseo.com/v3/serp/google/organic/live/advanced
// Auth: Basic auth with per-run vault login/password.
// Body: [{ keyword, location_code: 2840 (US), language_code: "en", depth: 1, people_also_ask_depth: 1 }]
// Response shape: { tasks: [{ result: [{ items: [..., { type: "people_also_ask", items: [{ question }] }] }] }] }
async function fetchDataForSeoPaa(
  query: string,
  signal: AbortSignal,
  fetchImpl: typeof fetch,
  credentials?: ResearchProviderCredentials,
): Promise<ResearchProviderPayload<string[]>> {
  const login = credentials?.dataforseo?.login ?? "";
  const password = credentials?.dataforseo?.password ?? "";
  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  const url = "https://api.dataforseo.com/v3/serp/google/organic/live/advanced";
  const body = [
    {
      keyword: query,
      location_code:
        credentials?.dataforseo?.locationCode ??
        Number.parseInt(process.env["DATAFORSEO_LOCATION_CODE"] ?? "2840", 10),
      language_code:
        credentials?.dataforseo?.languageCode ??
        process.env["DATAFORSEO_LANGUAGE_CODE"] ??
        "en",
      depth: 10,
      people_also_ask_depth: 1,
    },
  ];
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
    redirect: "error",
  });
  if (!res.ok) throw new Error(`dataforseo HTTP ${res.status}`);
  const data = (await res.json()) as {
    tasks?: Array<{
      cost?: number;
      result?: Array<{
        items?: Array<
          | { type?: string; title?: string }
          | {
              type?: "people_also_ask";
              items?: Array<{
                type?: string;
                title?: string;
                question?: string;
              }>;
            }
        >;
      }>;
    }>;
  };
  const questions: string[] = [];
  for (const task of data.tasks ?? []) {
    for (const r of task.result ?? []) {
      for (const item of r.items ?? []) {
        if (
          item &&
          item.type === "people_also_ask" &&
          Array.isArray((item as { items?: unknown[] }).items)
        ) {
          for (const child of (
            item as {
              items: Array<{
                type?: string;
                title?: string;
                question?: string;
              }>;
            }
          ).items) {
            const text = (child.question ?? child.title ?? "").trim();
            if (text && child.type === "people_also_ask_element")
              questions.push(text);
          }
        }
      }
    }
  }
  return { value: questions, actualCostUsd: extractDataForSeoCost(data) };
}

// ---- Custom scraper ----
//
// We hit https://www.google.com/search?q=<q> with a real desktop
// Chrome User-Agent and try multiple selector strategies in
// order. Anything that returns 0 is a known-fragile path — we
// surface that in the result but don't crash the run.
//
// Strategies (in order, first non-empty wins):
//   1. <div data-tts> or <div jsname="cPGTQd"> descendants —
//      modern Google uses these for the PAA accordion
//      question heading.
//   2. <div class*="related-question"> descendants — historical
//      class name still present on most queries.
//   3. <h3> whose text ends with "?" and lives near a
//      "People also ask" / "Other questions" anchor — broad
//      fallback. We cap to 8 hits to avoid pulling in random
//      question-shaped headings.
const GOOGLE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function fetchCustomScraperPaa(
  query: string,
  signal: AbortSignal,
  fetchImpl: typeof fetch,
): Promise<ResearchProviderPayload<string[]>> {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en&gl=us&num=20`;
  const res = await fetchImpl(url, {
    method: "GET",
    headers: {
      "User-Agent": GOOGLE_UA,
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml",
    },
    signal,
  });
  if (!res.ok) {
    // Google can return 302/429 to a captcha; surface that as
    // a clean error, not a stack trace.
    throw new Error(`google HTTP ${res.status}`);
  }
  const html = await res.text();
  return { value: parsePaaFromHtml(html), actualCostUsd: 0 };
}

/**
 * Parse a Google SERP HTML blob and extract People Also Ask
 * questions. Exported for unit testing. Tries three
 * strategies and returns the longest non-empty result.
 */
export function parsePaaFromHtml(html: string): string[] {
  if (!html || !html.trim()) return [];
  let doc: ReturnType<typeof parseHTML>["document"];
  try {
    doc = parseHTML(html).document;
  } catch {
    return [];
  }

  // Strategy 1: modern PAA heading container.
  // Google's 2024–2026 layout uses <div jsname="cPGTQd"> for
  // the PAA section; each child <div> contains a question
  // rendered as text.
  const modern = collectText(
    doc,
    '[jsname="cPGTQd"] div[role="button"], [jsname="cPGTQd"] [data-hveid] > div > div',
  );
  if (modern.length > 0) return dedupe(modern);

  // Strategy 2: historical class fragment. Still present in
  // many locales and never broken in 5 years.
  const historical = collectText(doc, '[class*="related-question"]');
  if (historical.length > 0) return dedupe(historical);

  // Strategy 3: any <h3> ending in "?" that sits near a
  // "People also ask" / "Other people also ask" header.
  // Search the whole document for h3+question; cheaper than
  // subtree scoping and the doc is small.
  const fallback: string[] = [];
  for (const h3 of doc.querySelectorAll("h3")) {
    const txt = (h3.textContent ?? "").trim();
    if (txt.length > 4 && txt.length < 200 && txt.endsWith("?")) {
      fallback.push(txt);
    }
    if (fallback.length >= 8) break;
  }
  if (fallback.length > 0) return dedupe(fallback);

  return [];
}

function collectText(
  doc: ReturnType<typeof parseHTML>["document"],
  selector: string,
): string[] {
  const out: string[] = [];
  for (const n of doc.querySelectorAll(selector)) {
    const t = (n.textContent ?? "").trim();
    if (t.length > 4 && t.length < 250) out.push(t);
    if (out.length >= 12) break;
  }
  return out;
}

function dedupe(arr: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of arr) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}
