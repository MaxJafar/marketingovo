// Sitemap evidence and checks. The fetch is shared by every sitemap rule and
// the final report so the UI sees the exact source data that produced issues.

import type { CheckFn, CrawlIndex, CrawledPage, Issue } from "./index.js";
import { isIndexable } from "./index.js";
import { createRenderer } from "../renderer.js";
import { loadLimits, type Limits } from "../core/limits.js";

const MAX_SITEMAP_CHILDREN = 20;
const MAX_SITEMAP_URLS = 100_000;
const SITEMAP_CHILD_CONCURRENCY = 4;

export type SitemapSnapshotState =
  "available" | "not_found" | "fetch_failed" | "invalid";

export type SitemapDocumentKind = "urlset" | "sitemapindex" | "unknown";

export interface SitemapFileSnapshot {
  url: string;
  kind: SitemapDocumentKind;
  statusCode: number | null;
  locCount: number;
}

export interface SitemapCrawlSnapshot {
  origin: string;
  sourceUrl: string;
  state: SitemapSnapshotState;
  statusCode: number | null;
  pageUrls: string[];
  files: SitemapFileSnapshot[];
  warnings: string[];
}

export interface ParsedSitemapDocument {
  kind: SitemapDocumentKind;
  locations: string[];
}

let cached: SitemapCrawlSnapshot | null = null;
let cachedFor: string | null = null;

let sitemapRenderer: {
  render: (
    url: string,
    opts: {
      timeoutMs: number;
      maxBodyBytes: number;
      userAgent: string;
      allowPrivate: boolean;
    },
  ) => Promise<{ status: number; body: Buffer }>;
} | null = null;
let sitemapLimits: Limits | null = null;

export function resetSitemapCache(): void {
  cached = null;
  cachedFor = null;
}

/** Initialize the shared renderer with the exact crawl limits. */
export function initSitemapFetcher(limits: Limits): void {
  sitemapLimits = limits;
  sitemapRenderer = null;
}

/** Read the snapshot produced by the current crawl without another request. */
export function getSitemapSnapshot(
  origin: string,
): SitemapCrawlSnapshot | null {
  if (cachedFor !== origin || !cached) return null;
  return structuredClone(cached);
}

export function parseSitemapDocument(xml: string): ParsedSitemapDocument {
  const kind: SitemapDocumentKind = /<\s*sitemapindex\b/i.test(xml)
    ? "sitemapindex"
    : /<\s*urlset\b/i.test(xml)
      ? "urlset"
      : "unknown";
  const locations: string[] = [];
  const expression = /<\s*loc\s*>\s*([^<]+?)\s*<\s*\/\s*loc\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(xml)) !== null) {
    const location = decodeXmlEntities(match[1] ?? "").trim();
    if (location) locations.push(location);
  }
  return { kind, locations };
}

async function fetchSitemap(origin: string): Promise<SitemapCrawlSnapshot> {
  if (cachedFor === origin && cached) return cached;
  const sourceUrl = `${origin.replace(/\/$/, "")}/sitemap.xml`;
  const limits = sitemapLimits ?? loadLimits();
  const baseSnapshot = (
    input: Omit<SitemapCrawlSnapshot, "origin" | "sourceUrl">,
  ): SitemapCrawlSnapshot => ({ origin, sourceUrl, ...input });

  if (!sitemapRenderer) {
    try {
      sitemapRenderer = await createRenderer("static", limits);
    } catch {
      return cacheSnapshot(
        origin,
        baseSnapshot({
          state: "fetch_failed",
          statusCode: null,
          pageUrls: [],
          files: [],
          warnings: ["The sitemap renderer could not be initialized."],
        }),
      );
    }
  }

  const root = await renderSitemapFile(sourceUrl, limits);
  if (root.statusCode === null || root.body === null) {
    return cacheSnapshot(
      origin,
      baseSnapshot({
        state: "fetch_failed",
        statusCode: null,
        pageUrls: [],
        files: [
          { url: sourceUrl, kind: "unknown", statusCode: null, locCount: 0 },
        ],
        warnings: ["The default sitemap could not be fetched."],
      }),
    );
  }
  if (root.statusCode >= 400) {
    return cacheSnapshot(
      origin,
      baseSnapshot({
        state:
          root.statusCode === 404 || root.statusCode === 410
            ? "not_found"
            : "fetch_failed",
        statusCode: root.statusCode,
        pageUrls: [],
        files: [
          {
            url: sourceUrl,
            kind: "unknown",
            statusCode: root.statusCode,
            locCount: 0,
          },
        ],
        warnings: [
          root.statusCode === 404 || root.statusCode === 410
            ? "No default /sitemap.xml was found."
            : `The default sitemap returned HTTP ${root.statusCode}.`,
        ],
      }),
    );
  }

  const rootDocument = parseSitemapDocument(root.body);
  if (rootDocument.kind === "unknown") {
    return cacheSnapshot(
      origin,
      baseSnapshot({
        state: "invalid",
        statusCode: root.statusCode,
        pageUrls: [],
        files: [
          {
            url: sourceUrl,
            kind: "unknown",
            statusCode: root.statusCode,
            locCount: rootDocument.locations.length,
          },
        ],
        warnings: [
          "The default sitemap did not contain a recognized urlset or sitemapindex root.",
        ],
      }),
    );
  }

  const warnings: string[] = [];
  const files: SitemapFileSnapshot[] = [
    {
      url: sourceUrl,
      kind: rootDocument.kind,
      statusCode: root.statusCode,
      locCount: rootDocument.locations.length,
    },
  ];
  const pageUrls: string[] = [];
  const seenPageUrls = new Set<string>();
  const appendPageLocations = (locations: readonly string[], base: string) => {
    let invalid = false;
    for (const location of locations) {
      const normalized = normalizeHttpUrl(location, base);
      if (!normalized) {
        invalid = true;
        continue;
      }
      if (seenPageUrls.has(normalized)) continue;
      if (pageUrls.length >= MAX_SITEMAP_URLS) {
        addWarning(
          warnings,
          `Sitemap URL capture stopped at the ${MAX_SITEMAP_URLS.toLocaleString("en-US")} URL safety boundary.`,
        );
        break;
      }
      seenPageUrls.add(normalized);
      pageUrls.push(normalized);
    }
    if (invalid)
      addWarning(warnings, "Invalid non-HTTP sitemap locations were skipped.");
  };

  if (rootDocument.kind === "urlset") {
    appendPageLocations(rootDocument.locations, sourceUrl);
  } else {
    const childUrls: string[] = [];
    const seenChildren = new Set<string>();
    for (const location of rootDocument.locations) {
      const childUrl = normalizeHttpUrl(location, sourceUrl);
      if (!childUrl) {
        addWarning(warnings, "Invalid sitemap-index locations were skipped.");
        continue;
      }
      if (new URL(childUrl).origin !== origin) {
        addWarning(
          warnings,
          "Cross-origin child sitemaps were not fetched by the local audit.",
        );
        continue;
      }
      if (seenChildren.has(childUrl)) continue;
      seenChildren.add(childUrl);
      childUrls.push(childUrl);
    }
    if (childUrls.length > MAX_SITEMAP_CHILDREN) {
      addWarning(
        warnings,
        `Only the first ${MAX_SITEMAP_CHILDREN} child sitemaps were fetched for this audit.`,
      );
    }
    const selectedChildren = childUrls.slice(0, MAX_SITEMAP_CHILDREN);
    await forEachBounded(
      selectedChildren,
      SITEMAP_CHILD_CONCURRENCY,
      async (childUrl) => {
        const child = await renderSitemapFile(childUrl, limits);
        if (child.statusCode === null || child.body === null) {
          files.push({
            url: childUrl,
            kind: "unknown",
            statusCode: null,
            locCount: 0,
          });
          addWarning(
            warnings,
            "One or more child sitemaps could not be fetched.",
          );
          return;
        }
        if (child.statusCode >= 400) {
          files.push({
            url: childUrl,
            kind: "unknown",
            statusCode: child.statusCode,
            locCount: 0,
          });
          addWarning(
            warnings,
            "One or more child sitemaps returned an HTTP error.",
          );
          return;
        }
        const document = parseSitemapDocument(child.body);
        files.push({
          url: childUrl,
          kind: document.kind,
          statusCode: child.statusCode,
          locCount: document.locations.length,
        });
        if (document.kind === "urlset") {
          appendPageLocations(document.locations, childUrl);
        } else if (document.kind === "sitemapindex") {
          addWarning(
            warnings,
            "A nested sitemap index was recorded but not expanded beyond one level.",
          );
        } else {
          addWarning(
            warnings,
            "One or more child sitemaps had an unrecognized document root.",
          );
        }
      },
    );
  }

  return cacheSnapshot(
    origin,
    baseSnapshot({
      state: "available",
      statusCode: root.statusCode,
      pageUrls,
      files,
      warnings,
    }),
  );
}

async function renderSitemapFile(
  url: string,
  limits: Limits,
): Promise<{ statusCode: number | null; body: string | null }> {
  try {
    const result = await sitemapRenderer!.render(url, {
      timeoutMs: Math.min(10_000, limits.requestTimeoutMs),
      maxBodyBytes: Math.min(5 * 1024 * 1024, limits.maxBodyBytes),
      userAgent: limits.userAgent,
      allowPrivate: limits.allowPrivate,
    });
    return {
      statusCode: result.status,
      body: result.body.toString("utf8"),
    };
  } catch {
    return { statusCode: null, body: null };
  }
}

function cacheSnapshot(
  origin: string,
  snapshot: SitemapCrawlSnapshot,
): SitemapCrawlSnapshot {
  cachedFor = origin;
  cached = snapshot;
  return snapshot;
}

function decodeXmlEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function normalizeHttpUrl(value: string, base?: string): string | null {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function addWarning(warnings: string[], warning: string): void {
  if (!warnings.includes(warning)) warnings.push(warning);
}

async function forEachBounded<T>(
  values: readonly T[],
  concurrency: number,
  task: (value: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const worker = async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      await task(values[index]!);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () =>
      worker(),
    ),
  );
}

function pageAliases(index: CrawlIndex): Map<string, CrawledPage> {
  const aliases = new Map<string, CrawledPage>();
  for (const page of index.pages.values()) {
    const requested = normalizeHttpUrl(page.url);
    const final = normalizeHttpUrl(page.finalUrl);
    if (requested) aliases.set(requested, page);
    if (final && !aliases.has(final)) aliases.set(final, page);
  }
  return aliases;
}

export const sitemapChecks: CheckFn[] = [
  async function sitemapBroken(index: CrawlIndex): Promise<Issue[]> {
    let origin: string;
    try {
      origin = new URL(index.startUrl).origin;
    } catch {
      return [];
    }
    const snapshot = await fetchSitemap(origin);
    if (snapshot.state !== "available") return [];
    const aliases = pageAliases(index);
    const broken = snapshot.pageUrls.filter((url) => {
      const page = aliases.get(url);
      return page ? page.status >= 400 : false;
    });
    if (broken.length === 0) return [];
    return [
      {
        id: "sitemap-4xx",
        category: "Sitemaps",
        priority: "Medium",
        message: `${broken.length} URL(s) in the captured sitemap returned 4xx/5xx.`,
        urls: broken,
        detail: { sourceUrl: snapshot.sourceUrl },
      },
    ];
  },

  async function sitemapMissing(index: CrawlIndex): Promise<Issue[]> {
    let origin: string;
    try {
      origin = new URL(index.startUrl).origin;
    } catch {
      return [];
    }
    const snapshot = await fetchSitemap(origin);
    if (snapshot.state !== "available") return [];
    const inSitemap = new Set(snapshot.pageUrls);
    const missing: string[] = [];
    for (const page of index.pages.values()) {
      if (!isIndexable(page)) continue;
      const finalUrl = normalizeHttpUrl(page.finalUrl);
      if (finalUrl && !inSitemap.has(finalUrl)) missing.push(finalUrl);
    }
    if (missing.length === 0) return [];
    return [
      {
        id: "sitemap-missing",
        category: "Sitemaps",
        priority: "Low",
        message: `${missing.length} indexable URL(s) not listed in the captured sitemap.`,
        urls: [...new Set(missing)],
        detail: { sourceUrl: snapshot.sourceUrl },
      },
    ];
  },
];
