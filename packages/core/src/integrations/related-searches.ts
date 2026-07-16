// "Related Searches" integration. Mirrors paa.ts in shape:
// three real backends, key-less custom scraper as the
// universal fallback.
//
//   1. SERPAPI  — paid. Returns the "related_searches" array
//      from the standard google engine response. Same env
//      key from the per-run local vault context.
//   2. DATAFORSEO  — paid. The "related_searches" items come
//      as type:"related_searches" with a "title" field.
//   3. CUSTOM SCRAPER  — free. Parses the bottom anchor list
//      of https://www.google.com/search?q=<q>. Multiple
//      selector strategies; first non-empty wins.
//
// All three are best-effort. Failures are surfaced in the
// result, not thrown.

import { parseHTML } from "linkedom";
import type { ResearchProviderCredentials } from "./paa.js";
import { safeResearchProviderFetch } from "./research-provider-fetch.js";
import {
  extractDataForSeoCost,
  providerUsage,
  type ResearchProviderPayload,
  type ResearchProviderUsage,
} from "./provider-usage.js";

export type RelatedBackend = "serpapi" | "dataforseo" | "custom";

export interface RelatedSearchResult {
  backend: RelatedBackend;
  items: string[];
  error: string | null;
  requiresKey: boolean;
  durationMs: number;
  /** Provider economics for transparent BYOK accounting. */
  usage: ResearchProviderUsage;
}

export interface RelatedOptions {
  timeoutMs?: number;
  backends?: readonly RelatedBackend[];
  fetchImpl?: typeof fetch;
  credentials?: ResearchProviderCredentials;
}

const ALL_BACKENDS: readonly RelatedBackend[] = [
  "serpapi",
  "dataforseo",
  "custom",
];

export function isAvailable(): boolean {
  return typeof fetch === "function";
}

export function availableBackends(
  credentials?: ResearchProviderCredentials,
): RelatedBackend[] {
  const out: RelatedBackend[] = [];
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

export async function relatedAll(
  query: string,
  opts: RelatedOptions = {},
): Promise<RelatedSearchResult[]> {
  const backends =
    opts.backends && opts.backends.length > 0 ? opts.backends : ALL_BACKENDS;
  const fetcher = opts.fetchImpl ?? safeResearchProviderFetch;
  const tasks = backends.map((b) =>
    relatedOne(query, b, opts.timeoutMs ?? 5_000, fetcher, opts.credentials),
  );
  return Promise.all(tasks);
}

export async function relatedBest(
  query: string,
  opts: RelatedOptions = {},
): Promise<RelatedSearchResult> {
  const all = await relatedAll(query, opts);
  const withItems = all.find((r) => r.items.length > 0);
  return withItems ?? all[0] ?? emptyResult("custom", 0);
}

export async function relatedOne(
  query: string,
  backend: RelatedBackend,
  timeoutMs = 5_000,
  fetchImpl: typeof fetch = safeResearchProviderFetch,
  credentials?: ResearchProviderCredentials,
): Promise<RelatedSearchResult> {
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
        result = await fetchSerpApiRelated(
          query,
          ac.signal,
          fetchImpl,
          credentials,
        );
        break;
      case "dataforseo":
        result = await fetchDataForSeoRelated(
          query,
          ac.signal,
          fetchImpl,
          credentials,
        );
        break;
      case "custom":
        result = await fetchCustomScraperRelated(query, ac.signal, fetchImpl);
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

function emptyResult(
  backend: RelatedBackend,
  durationMs: number,
): RelatedSearchResult {
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
// Response shape: { related_searches: [{ query: "..." }, ...] }
async function fetchSerpApiRelated(
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
    related_searches?: Array<{ query?: string }>;
  };
  const out: string[] = [];
  for (const r of data.related_searches ?? []) {
    if (typeof r.query === "string" && r.query.trim()) out.push(r.query.trim());
  }
  return { value: out, actualCostUsd: null };
}

// ---- DataForSEO ----
//
// Response shape (under items): { type: "related_searches", title: "..." }
async function fetchDataForSeoRelated(
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
        items?: Array<{ type?: string; title?: string }>;
      }>;
    }>;
  };
  const out: string[] = [];
  for (const task of data.tasks ?? []) {
    for (const r of task.result ?? []) {
      for (const item of r.items ?? []) {
        if (
          item?.type === "related_searches" &&
          typeof item.title === "string" &&
          item.title.trim()
        ) {
          out.push(item.title.trim());
        }
      }
    }
  }
  return { value: out, actualCostUsd: extractDataForSeoCost(data) };
}

// ---- Custom scraper ----
//
// The "Related searches" list at the bottom of a Google SERP
// is rendered as a grid of <a> tags. The class names change
// every few months, so we try several selectors and pick the
// longest non-empty result.
const GOOGLE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function fetchCustomScraperRelated(
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
  if (!res.ok) throw new Error(`google HTTP ${res.status}`);
  const html = await res.text();
  return { value: parseRelatedFromHtml(html), actualCostUsd: 0 };
}

/**
 * Parse Related Searches from a Google SERP HTML blob.
 * Exported for tests. Tries multiple selectors; longest
 * non-empty wins.
 */
export function parseRelatedFromHtml(html: string): string[] {
  if (!html || !html.trim()) return [];
  let doc: ReturnType<typeof parseHTML>["document"];
  try {
    doc = parseHTML(html).document;
  } catch {
    return [];
  }

  // Strategy 1: 2024–2026 modern layout uses an explicit
  // <div> with the section anchor text "People also search
  // for" or "Related searches" and a grid of <a> children.
  // We anchor on the section header text to be robust to
  // class renames.
  const sectionAnchors = ["People also search for", "Related searches"];
  for (const anchor of sectionAnchors) {
    for (const h of doc.querySelectorAll(
      "h2, h3, [role='heading'], div[aria-level]",
    )) {
      if ((h.textContent ?? "").trim().toLowerCase() !== anchor.toLowerCase())
        continue;
      // Walk up to a containing <div>, then collect anchor
      // text inside it. The grid is usually a sibling or
      // close ancestor, not a child of the header.
      let container:
        ReturnType<typeof parseHTML>["document"]["documentElement"] | null =
        h.parentElement;
      for (let i = 0; i < 4 && container; i += 1) {
        const texts: string[] = [];
        for (const a of container.querySelectorAll("a")) {
          const t = (a.textContent ?? "").trim();
          // Related searches are short (2–6 words), don't
          // contain "?", and don't navigate off the page.
          if (
            t.length >= 3 &&
            t.length < 80 &&
            !t.includes("?") &&
            !t.includes("›")
          )
            texts.push(t);
        }
        if (texts.length >= 4) return dedupe(texts);
        container = container.parentElement;
      }
    }
  }

  // Strategy 2: historical CSS hooks. Several have come and
  // gone; we try a broad set and pick the longest hit.
  const historicalSelectors = [
    "div.AJLUJb > div > a", // 2023 grid
    "div.Bk5Auf a", // 2022 grid
    "div.s75CSd a", // 2021 grid
    "div.card-section a", // generic
  ];
  for (const sel of historicalSelectors) {
    const texts: string[] = [];
    for (const a of doc.querySelectorAll(sel)) {
      const t = (a.textContent ?? "").trim();
      if (t.length >= 3 && t.length < 80 && !t.includes("?")) texts.push(t);
      if (texts.length >= 12) break;
    }
    if (texts.length >= 4) return dedupe(texts);
  }

  // Strategy 3: last-ditch — find any <a> whose href is a
  // google.com/search URL and collect their visible text.
  // Filter to reasonable lengths. Conservative cap.
  const fallback: string[] = [];
  for (const a of doc.querySelectorAll('a[href*="/search?"]')) {
    const t = (a.textContent ?? "").trim();
    if (t.length >= 3 && t.length < 80 && !t.includes("?")) fallback.push(t);
    if (fallback.length >= 12) break;
  }
  return dedupe(fallback);
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
