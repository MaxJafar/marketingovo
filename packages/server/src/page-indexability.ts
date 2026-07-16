const NOINDEX_REASONS = new Set(["meta_noindex", "x_robots_noindex"]);
const CANONICAL_REASONS = new Set(["canonicalized"]);

export type DashboardPageIndexability =
  "indexable" | "blocked" | "noindex" | "canonicalized" | "unknown";

export function storedIndexabilityReason(
  payload: Record<string, unknown>,
): string | null {
  return typeof payload.indexabilityReason === "string" &&
    payload.indexabilityReason.trim()
    ? payload.indexabilityReason
    : null;
}

export function dashboardPageIndexability(
  indexable: boolean | null,
  reason: string | null,
): DashboardPageIndexability {
  if (indexable === null) return "unknown";
  if (indexable) return "indexable";
  if (reason && NOINDEX_REASONS.has(reason)) return "noindex";
  if (reason && CANONICAL_REASONS.has(reason)) return "canonicalized";
  return "blocked";
}
