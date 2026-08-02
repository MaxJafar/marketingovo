import type { MetricValue } from "../api/contracts";

/**
 * Formatting and demo scaffolding for the console dashboard.
 *
 * Two of the four headline panels — social mentions and brand sentiment — have
 * no connector behind them yet. Rather than showing empty frames on a fresh
 * install, those panels fall back to a fixed sample set that is always rendered
 * behind a visible DEMO flag. The flag is the whole point: a marketer must never
 * be unable to tell a real measurement from a placeholder, so the fallback is
 * loud rather than seamless, and any panel with a live source never uses it.
 */

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (magnitude >= 1_000) return `${trim(value / 1_000)}K`;
  return trim(value);
}

export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return value % 1 === 0 ? `${value}` : value.toFixed(1);
}

function trim(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded % 1 === 0 ? `${rounded}` : rounded.toFixed(1);
}

export interface Delta {
  direction: "up" | "down" | "flat";
  label: string;
}

export function toDelta(change: number | null | undefined): Delta | null {
  if (change === null || change === undefined || !Number.isFinite(change)) {
    return null;
  }
  if (Math.abs(change) < 0.05) return { direction: "flat", label: "no change" };
  const direction = change > 0 ? "up" : "down";
  const arrow = change > 0 ? "▲" : "▼";
  return { direction, label: `${arrow} ${Math.abs(change).toFixed(1)}%` };
}

export function metricNumber(metric: MetricValue | undefined): number | null {
  const value = metric?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** True when the daemon says it has nothing rather than a real zero. */
export function metricMissing(metric: MetricValue | undefined): boolean {
  return metricNumber(metric) === null;
}

/* ------------------------------------------------------------------ */
/* Demo sample set                                                     */
/* ------------------------------------------------------------------ */

export const DEMO = {
  visibility: 78.4,
  visibilityChange: 12.6,
  traffic: 128_600,
  trafficChange: 18.2,
  mentions: 9_700,
  mentionsChange: 24.1,
  sentiment: 85,
  sentimentChange: 7.3,

  visibilitySpark: [42, 55, 48, 63, 58, 71, 66, 79],
  trafficSpark: [58, 44, 62, 51, 69, 74, 66, 82],
  mentionsSpark: [31, 47, 39, 58, 52, 68, 61, 77],
  sentimentSpark: [64, 58, 71, 66, 74, 69, 80, 85],

  domainHealth: 82,
  health: [
    { name: "Crawlability", value: 92 },
    { name: "Site Performance", value: 78 },
    { name: "On-Page SEO", value: 81 },
    { name: "Backlinks", value: 75 },
    { name: "Content Quality", value: 84 },
  ],

  mentionsAxis: ["May 4", "May 11", "May 18", "May 25", "Jun 1"],
  mentionsSeries: [
    {
      id: "total",
      label: "All platforms",
      colour: "var(--px-pink)",
      points: [
        1180, 1320, 1260, 1520, 1680, 1610, 1840, 1780, 2020, 2140, 2080, 2260,
        2420, 2380, 2540,
      ],
    },
    {
      id: "owned",
      label: "Owned channels",
      colour: "var(--px-cyan)",
      points: [
        720, 860, 810, 940, 1020, 980, 1140, 1090, 1210, 1180, 1320, 1280, 1400,
        1360, 1480,
      ],
    },
    {
      id: "earned",
      label: "Earned mentions",
      colour: "var(--px-pink-dim)",
      points: [
        420, 380, 510, 470, 560, 620, 580, 700, 660, 780, 740, 860, 820, 940,
        900,
      ],
    },
  ],

  platforms: [
    { id: "twitter", name: "Twitter", count: 3_200 },
    { id: "instagram", name: "Instagram", count: 2_700 },
    { id: "tiktok", name: "TikTok", count: 2_100 },
    { id: "reddit", name: "Reddit", count: 1_700 },
  ],

  keywords: [
    { keyword: "marketing tools", position: 3, volume: 12_100 },
    { keyword: "seo analytics", position: 5, volume: 8_900 },
    { keyword: "social media intel", position: 2, volume: 6_500 },
    { keyword: "competitor analysis", position: 7, volume: 4_400 },
    { keyword: "content strategy", position: 4, volume: 3_200 },
  ],

  competitors: [
    { domain: "competitor.com", visibility: 64.2, traffic: 96_100 },
    { domain: "rival.io", visibility: 55.1, traffic: 73_400 },
    { domain: "brandwatch.io", visibility: 48.7, traffic: 61_200 },
    { domain: "mention.com", visibility: 41.3, traffic: 49_800 },
  ],

  feed: [
    {
      id: "strategy",
      glyph: "strategy",
      title: "How to Build a Data-Driven Marketing Strategy",
      tag: "Trending",
      tone: "cyan" as const,
      views: 12_400,
      comments: 256,
      links: 87,
    },
    {
      id: "trend",
      glyph: "trend",
      title: "Top 10 SEO Trends You Can't Ignore This Year",
      tag: "High engagement",
      tone: "hot" as const,
      views: 8_700,
      comments: 142,
      links: 63,
    },
    {
      id: "benchmark",
      glyph: "benchmark",
      title: "Social Media Benchmark Report Q2",
      tag: "Viral",
      tone: "gold" as const,
      views: 24_100,
      comments: 512,
      links: 201,
    },
  ],
} as const;

/** Evenly sampled sparkline input from an arbitrary-length trend series. */
export function toSpark(values: number[], buckets = 8): number[] {
  if (values.length === 0) return [];
  if (values.length <= buckets) return values;
  const step = values.length / buckets;
  return Array.from(
    { length: buckets },
    (_, index) => values[Math.floor(index * step)] ?? 0,
  );
}
