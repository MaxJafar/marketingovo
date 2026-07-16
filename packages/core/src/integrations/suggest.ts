// Autocomplete / suggest client. Pulls real search-suggestion data
// from public endpoints that don't require API keys:
//
//   1. Google (web search suggestions, Firefox client — no token
//      cookie, JSON shape, well-known pattern)
//   2. YouTube (same Google suggest endpoint, `ds=yt` switch)
//   3. Bing (HTML scraping is fragile; the JSON endpoint at
//      /AS/Suggestions is officially undocumented but has been
//      stable for years and returns a small JSON array)
//   4. Amazon (the completion.amazon.com API used by Amazon's
//      own search box; returns up to 10 keyword suggestions
//      ranked by their internal relevance model)
//   5. Wikipedia (the OpenSearch API; returns 4 canonical page
//      titles — useful for entity / topic clustering)
//
// All five are public, free, and rate-limited only by the
// provider's own polite-use threshold. We use a short timeout
// (3s) and treat any failure as "no suggestions from this
// source" rather than crashing.
//
// Reference URLs (these are the same endpoints the providers
// use in their own UI; we are not bypassing any auth):
//   Google:  https://suggestqueries.google.com/complete/search?client=firefox&q=<q>
//   YouTube: https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=<q>
//   Bing:    https://www.bing.com/AS/Suggestions?pt=page.serp&mkt=en-us&qry=<q>&cp=1&cvid=1
//   Amazon:  https://completion.amazon.com/api/2017/suggestions?mid=ATVPDKIKX0DER&alias=aps&suggestion-type=KEYWORD&prefix=<q>
//   Wiki:    https://en.wikipedia.org/w/api.php?action=opensearch&format=json&search=<q>&limit=10

export type SuggestSource =
  "google" | "youtube" | "bing" | "amazon" | "wikipedia";

export interface SuggestHit {
  /** The suggestion text. */
  term: string;
  /** Which source it came from. */
  source: SuggestSource;
}

export interface SuggestResult {
  source: SuggestSource;
  hits: SuggestHit[];
  /** Populated on failure (timeout, parse error, non-2xx). */
  error: string | null;
  durationMs: number;
}

export interface SuggestOptions {
  /** Restrict to specific sources. Default: all five. */
  sources?: readonly SuggestSource[];
  /** Per-source timeout in ms. Default 3_000. */
  timeoutMs?: number;
  /** Override the fetch implementation (for tests). */
  fetchImpl?: typeof fetch;
}

const ALL_SOURCES: readonly SuggestSource[] = [
  "google",
  "youtube",
  "bing",
  "amazon",
  "wikipedia",
];

export function isAvailable(): boolean {
  return typeof fetch === "function";
}

/**
 * Pull suggestions for a single query across all configured sources
 * in parallel. Each source is independent — one failure does not
 * affect the others.
 */
export async function suggestAll(
  query: string,
  opts: SuggestOptions = {},
): Promise<SuggestResult[]> {
  const sources =
    opts.sources && opts.sources.length > 0 ? opts.sources : ALL_SOURCES;
  const fetcher = opts.fetchImpl ?? fetch;
  const tasks = sources.map((s) =>
    suggestOne(query, s, opts.timeoutMs ?? 3_000, fetcher),
  );
  return Promise.all(tasks);
}

export async function suggestOne(
  query: string,
  source: SuggestSource,
  timeoutMs = 3_000,
  fetchImpl: typeof fetch = fetch,
): Promise<SuggestResult> {
  const started = Date.now();
  if (!query || !query.trim()) {
    return { source, hits: [], error: "empty query", durationMs: 0 };
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const url = buildUrl(source, query);
    if (!url) {
      return {
        source,
        hits: [],
        error: "no endpoint for source",
        durationMs: Date.now() - started,
      };
    }
    const res = await fetchImpl(url, {
      method: "GET",
      headers: { accept: "application/json, text/plain" },
      signal: ac.signal,
    });
    if (!res.ok) {
      return {
        source,
        hits: [],
        error: `HTTP ${res.status}`,
        durationMs: Date.now() - started,
      };
    }
    const text = await res.text();
    const hits = parse(source, text);
    return { source, hits, error: null, durationMs: Date.now() - started };
  } catch (err) {
    return {
      source,
      hits: [],
      error: (err as Error).message,
      durationMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildUrl(source: SuggestSource, q: string): string | null {
  const enc = encodeURIComponent(q);
  switch (source) {
    case "google":
      return `https://suggestqueries.google.com/complete/search?client=firefox&q=${enc}`;
    case "youtube":
      return `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${enc}`;
    case "bing":
      // Bing's JSON endpoint needs a few query params; cp=1 means
      // "show 1 suggestion row", cvid is a stable token (any value
      // works in practice).
      return `https://www.bing.com/AS/Suggestions?pt=page.serp&mkt=en-us&qry=${enc}&cp=1&cvid=1`;
    case "amazon":
      // mid is the Amazon US marketplace id (ATVPDKIKX0DER). Other
      // marketplaces use different ids. We're using US as the default.
      return `https://completion.amazon.com/api/2017/suggestions?mid=ATVPDKIKX0DER&alias=aps&suggestion-type=KEYWORD&prefix=${enc}`;
    case "wikipedia":
      return `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&search=${enc}&limit=10`;
    default:
      return null;
  }
}

/**
 * Parse the raw text response into SuggestHit[]. Exported for
 * unit testing. Each source has a different shape:
 *   - Google / YouTube: `["query", ["a", "b", "c"]]` (Firefox client)
 *   - Bing: `{"AS":{"Results":[{"Suggests":[{"Txt":"a"}, ...]}]}}`
 *   - Amazon: `{"suggestions": [{"value": "a"}, ...]}`
 *   - Wikipedia: `["query", ["a", "b"], [...], ["url1", ...]]`
 */
export function parse(source: SuggestSource, text: string): SuggestHit[] {
  if (!text || !text.trim()) return [];
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return [];
  }
  switch (source) {
    case "google":
    case "youtube": {
      // Firefox shape: [query, [term1, term2, ...], ...]
      if (!Array.isArray(json) || !Array.isArray(json[1])) return [];
      return (json[1] as unknown[])
        .filter((x): x is string => typeof x === "string" && x.length > 0)
        .map((term) => ({ term, source }));
    }
    case "bing": {
      // Shape: { AS: { Results: [ { Suggests: [ { Txt: "..." } ] } ] } }
      const as = (
        json as {
          AS?: { Results?: Array<{ Suggests?: Array<{ Txt?: string }> }> };
        }
      ).AS;
      const results = as?.Results ?? [];
      const out: SuggestHit[] = [];
      for (const r of results) {
        for (const s of r.Suggests ?? []) {
          if (typeof s.Txt === "string" && s.Txt.length > 0)
            out.push({ term: s.Txt, source });
        }
      }
      return out;
    }
    case "amazon": {
      // Shape: { suggestions: [ { value: "..." }, ... ] }
      const suggestions = (json as { suggestions?: Array<{ value?: string }> })
        .suggestions;
      if (!Array.isArray(suggestions)) return [];
      return suggestions
        .filter(
          (s): s is { value: string } =>
            typeof s?.value === "string" && s.value.length > 0,
        )
        .map((s) => ({ term: s.value, source }));
    }
    case "wikipedia": {
      // Shape: [query, [term1, term2, ...], [...descs...], [...urls...]]
      if (!Array.isArray(json) || !Array.isArray(json[1])) return [];
      return (json[1] as unknown[])
        .filter((x): x is string => typeof x === "string" && x.length > 0)
        .map((term) => ({ term, source }));
    }
    default:
      return [];
  }
}

/**
 * Deduplicate suggestions across sources. Returns hits in
 * "most-appeared first" order (terms that show up in multiple
 * sources rank higher). Within the same count, the first source
 * order wins.
 */
export function dedupeAndRank(hits: readonly SuggestHit[]): SuggestHit[] {
  const byTerm = new Map<
    string,
    { hit: SuggestHit; count: number; firstSource: number }
  >();
  const sourceOrder: SuggestSource[] = [
    "google",
    "youtube",
    "bing",
    "amazon",
    "wikipedia",
  ];
  for (const h of hits) {
    const key = h.term.trim().toLowerCase();
    if (!key) continue;
    const existing = byTerm.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      byTerm.set(key, {
        hit: h,
        count: 1,
        firstSource: sourceOrder.indexOf(h.source),
      });
    }
  }
  const ranked = Array.from(byTerm.values());
  ranked.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.firstSource - b.firstSource;
  });
  return ranked.map((r) => r.hit);
}
