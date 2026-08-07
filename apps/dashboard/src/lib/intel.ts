import type { MetricValue } from "../api/contracts";

/**
 * Formatting helpers for the console dashboard.
 *
 * There is deliberately no sample set here. A panel whose source has not
 * reported renders its reason and a route to fixing it — never a placeholder
 * number, because a figure a marketer cannot trust poisons the ones they can.
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
