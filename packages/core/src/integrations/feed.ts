// Competitor publishing cadence from a site's own RSS or Atom feed.
//
// A crawl tells you what a competitor's pages look like. It does not tell you
// how fast they ship, which is the question a content team actually asks when
// planning against a rival. A feed answers it directly: it is public by
// construction, needs no credentials, is explicitly meant for machines, and
// carries publication timestamps.
//
// What this deliberately does not do is infer engagement, audience, reach or
// revenue. None of those are in a feed, and inventing them is the failure mode
// this product exists to avoid. Everything absent is reported as unavailable
// rather than as zero.
//
// Fetching goes through the existing Fetcher and RobotsCache, so the SSRF
// guard, redirect policy, body bounds and robots handling are the same ones the
// crawler uses. This module adds no transport of its own.

import type { Fetcher } from "../fetcher.js";
import type { RobotsCache } from "../core/robots.js";
import { normalizeUrl, UnsafeUrlError } from "../core/safe-url.js";

/** One published entry, reduced to what a feed actually states. */
export interface FeedItem {
  id: string;
  title: string;
  link: string;
  publishedAt: Date | null;
}

/**
 * Publishing evidence for one site. Every field is either measured or
 * explicitly null; there is no zero standing in for "we could not tell".
 */
export interface PublishingCadence {
  feedUrl: string;
  /** Entries the feed exposed. Most feeds are truncated, so this is not a total. */
  itemsInFeed: number;
  /** Entries carrying a parseable date, which is what the rates below divide. */
  datedItems: number;
  /** Seconds since the newest dated entry, or null when nothing is dated. */
  freshnessSeconds: number | null;
  /** Mean days between consecutive posts, or null without at least one interval. */
  cadenceDays: number | null;
  /** The span the cadence was measured over, so the figure can be audited. */
  spanDays: number | null;
  intervals: number | null;
  newestPublishedAt: string | null;
  oldestPublishedAt: string | null;
}

export type FeedUnavailableReason =
  | "no-feed-discovered"
  | "blocked-by-robots"
  | "unsafe-url"
  | "fetch-failed"
  | "unparseable";

export interface FeedOutcome {
  target: string;
  cadence: PublishingCadence | null;
  unavailable: FeedUnavailableReason | null;
  detail?: string;
}

const FEED_LINK =
  /<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/gi;
const HREF = /href=["']([^"']+)["']/i;

// Checked in order. A site that declares its feed is preferred over guessing.
const CONVENTIONAL_PATHS = [
  "/feed",
  "/feed.xml",
  "/rss",
  "/rss.xml",
  "/atom.xml",
  "/index.xml",
  "/blog/feed",
  "/blog/rss.xml",
];

const TIME_PATTERNS: Array<(value: string) => number> = [
  (value) => Date.parse(value),
];

function parseFeedTime(value: string | undefined): Date | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  for (const parse of TIME_PATTERNS) {
    const ms = parse(text);
    if (Number.isFinite(ms)) return new Date(ms);
  }
  return null;
}

function firstTag(block: string, tag: string): string {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(
    block,
  );
  if (!match?.[1]) return "";
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/**
 * Parses RSS 2.0 and Atom. Deliberately regex-based rather than a full XML
 * parser: feeds in the wild are frequently malformed, and a strict parser
 * rejects entire documents over one bad entry. Reading fewer entries is a
 * better failure than reading none.
 */
export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];

  for (const match of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const block = match[0];
    const link = firstTag(block, "link");
    const guid = firstTag(block, "guid");
    const title = firstTag(block, "title");
    items.push({
      id: guid || link || title,
      title,
      link,
      publishedAt:
        parseFeedTime(firstTag(block, "pubDate")) ??
        parseFeedTime(firstTag(block, "dc:date")),
    });
  }
  if (items.length > 0) return items;

  for (const match of xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)) {
    const block = match[0];
    const id = firstTag(block, "id");
    const title = firstTag(block, "title");
    // Atom links carry the URL in an attribute, not as element text.
    const linkMatch = /<link[^>]*\bhref=["']([^"']+)["'][^>]*>/i.exec(block);
    const link = linkMatch?.[1] ?? "";
    items.push({
      id: id || link || title,
      title,
      link,
      publishedAt:
        parseFeedTime(firstTag(block, "published")) ??
        parseFeedTime(firstTag(block, "updated")),
    });
  }
  return items;
}

/**
 * Turns feed entries into cadence evidence.
 *
 * The honesty rules here are the point of the module: a single dated entry
 * yields no cadence because the span is zero and dividing by it would fabricate
 * a rate, and a feed with no dates yields a count and nothing else. A missing
 * cadence is never reported as a cadence of zero.
 */
export function summarizeCadence(
  feedUrl: string,
  items: FeedItem[],
  now: Date,
): PublishingCadence {
  const dated = items
    .filter((item): item is FeedItem & { publishedAt: Date } =>
      Boolean(item.publishedAt),
    )
    .sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());

  const base: PublishingCadence = {
    feedUrl,
    itemsInFeed: items.length,
    datedItems: dated.length,
    freshnessSeconds: null,
    cadenceDays: null,
    spanDays: null,
    intervals: null,
    newestPublishedAt: null,
    oldestPublishedAt: null,
  };
  if (dated.length === 0) return base;

  const oldest = dated[0]!.publishedAt;
  const newest = dated[dated.length - 1]!.publishedAt;
  base.newestPublishedAt = newest.toISOString();
  base.oldestPublishedAt = oldest.toISOString();
  base.freshnessSeconds = Math.max(
    0,
    Math.round((now.getTime() - newest.getTime()) / 1000),
  );

  const intervals = dated.length - 1;
  if (intervals >= 1 && newest.getTime() > oldest.getTime()) {
    const spanDays =
      (newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24);
    base.spanDays = spanDays;
    base.intervals = intervals;
    base.cadenceDays = spanDays / intervals;
  }
  return base;
}

async function readBody(
  fetcher: Fetcher,
  url: string,
  maxBodyBytes: number,
): Promise<string | null> {
  try {
    const result = await fetcher.fetchRaw(url, {
      maxBodyBytes,
      acceptAnyStatus: true,
    });
    if (result.status >= 400) return null;
    return result.body.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Finds a site's feed: its own declaration first, then conventional paths.
 * Every candidate is robots-checked before it is requested.
 */
export async function discoverFeedUrl(
  fetcher: Fetcher,
  robots: RobotsCache,
  siteUrl: string,
  maxBodyBytes: number,
): Promise<string | null> {
  const base = new URL(normalizeUrl(siteUrl).href);

  if (await robots.isAllowed(base.href)) {
    const html = await readBody(fetcher, base.href, maxBodyBytes);
    if (html) {
      for (const tag of html.match(FEED_LINK) ?? []) {
        const href = HREF.exec(tag)?.[1];
        if (!href) continue;
        try {
          const resolved = new URL(href, base).href;
          normalizeUrl(resolved);
          if (await robots.isAllowed(resolved)) return resolved;
        } catch {
          // A malformed or unsafe declared feed is skipped, not fatal: the
          // conventional paths below may still find a usable one.
        }
      }
    }
  }

  for (const path of CONVENTIONAL_PATHS) {
    const candidate = new URL(path, base).href;
    if (!(await robots.isAllowed(candidate))) continue;
    const body = await readBody(fetcher, candidate, maxBodyBytes);
    if (body && parseFeed(body).length > 0) return candidate;
  }
  return null;
}

/** Collects publishing cadence for one site, reporting why when it cannot. */
export async function collectPublishingCadence(
  fetcher: Fetcher,
  robots: RobotsCache,
  target: string,
  options: { maxBodyBytes: number; now?: Date },
): Promise<FeedOutcome> {
  try {
    normalizeUrl(target);
  } catch (error) {
    return {
      target,
      cadence: null,
      unavailable: "unsafe-url",
      detail: error instanceof UnsafeUrlError ? error.message : undefined,
    };
  }

  const feedUrl = await discoverFeedUrl(
    fetcher,
    robots,
    target,
    options.maxBodyBytes,
  );
  if (!feedUrl) {
    return { target, cadence: null, unavailable: "no-feed-discovered" };
  }
  if (!(await robots.isAllowed(feedUrl))) {
    return { target, cadence: null, unavailable: "blocked-by-robots" };
  }

  const body = await readBody(fetcher, feedUrl, options.maxBodyBytes);
  if (body === null) {
    return { target, cadence: null, unavailable: "fetch-failed" };
  }
  const items = parseFeed(body);
  if (items.length === 0) {
    return { target, cadence: null, unavailable: "unparseable" };
  }
  return {
    target,
    cadence: summarizeCadence(feedUrl, items, options.now ?? new Date()),
    unavailable: null,
  };
}

/**
 * Collects cadence for one target, assembling the same transport the crawler
 * uses. This exists so a caller does not have to build a Fetcher, a renderer
 * and a robots cache to ask one question — the absence of which is why the
 * capability sat unreachable after it was written.
 */
export async function collectCadenceForTarget(
  target: string,
  options: {
    privateHostAllowlist?: string[];
    userAgent?: string;
    signal?: AbortSignal;
  } = {},
): Promise<FeedOutcome> {
  const { Fetcher } = await import("../fetcher.js");
  const { RobotsCache } = await import("../core/robots.js");
  const { createRenderer } = await import("../renderer.js");
  const { loadLimits } = await import("../core/limits.js");

  const allowlist: string[] = options.privateHostAllowlist ?? [];
  const limits = {
    ...loadLimits(),
    allowPrivate: allowlist.length > 0,
    renderMode: "static" as const,
  };
  const userAgent = options.userAgent ?? limits.userAgent;
  const renderer = await createRenderer("static", limits);
  const robots = new RobotsCache(renderer, userAgent, {
    allowPrivate: allowlist.length > 0,
    privateHostAllowlist: allowlist,
    enforcePrivateHostAllowlist: allowlist.length > 0,
    signal: options.signal,
  });
  const fetcher = new Fetcher(limits);
  try {
    return await collectPublishingCadence(fetcher, robots, target, {
      maxBodyBytes: limits.maxBodyBytes,
    });
  } finally {
    fetcher.close();
  }
}
