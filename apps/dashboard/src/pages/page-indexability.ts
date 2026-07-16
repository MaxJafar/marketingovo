import type { PageRecord } from "../api/contracts";

const REASON_LABELS: Record<string, string> = {
  indexable: "Verified from crawl evidence",
  robots_blocked: "Blocked by robots.txt",
  meta_noindex: "Meta robots noindex",
  x_robots_noindex: "X-Robots-Tag noindex",
  canonicalized: "Canonical points to another URL",
  non_html: "Non-HTML response",
  redirect: "Redirect response",
  http_error: "HTTP error response",
  no_content: "No response content",
  fetch_error: "Fetch failed",
  missing_status: "HTTP status unavailable",
  unexpected_status: "Unexpected HTTP status",
  missing_content_type: "Content type unavailable",
  robots_unknown: "Robots evidence unavailable",
  parse_failed: "HTML evidence unavailable",
};

export function indexabilityReasonLabel(page: PageRecord): string {
  const reason = page.indexabilityReason;
  if (reason && REASON_LABELS[reason]) return REASON_LABELS[reason];
  if (reason) return reason.replaceAll("_", " ");
  if (page.indexability === "indexable") return REASON_LABELS.indexable;
  if (page.indexability === "unknown") return "Evidence unavailable";
  return "Legacy audit result";
}
