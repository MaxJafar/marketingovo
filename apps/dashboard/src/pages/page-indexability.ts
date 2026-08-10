import type { PageRecord } from "../api/contracts";
import type { Messages } from "../i18n";

/**
 * API reason codes mapped onto their message keys in `pages.indexability`.
 * The codes are wire values, so an unrecognized one falls through to the
 * humanized raw string below rather than disappearing.
 */
const REASON_KEYS: Record<
  string,
  keyof Messages["pages"]["indexability"]["reasons"]
> = {
  indexable: "indexable",
  robots_blocked: "robotsBlocked",
  meta_noindex: "metaNoindex",
  x_robots_noindex: "xRobotsNoindex",
  canonicalized: "canonicalized",
  non_html: "nonHtml",
  redirect: "redirect",
  http_error: "httpError",
  no_content: "noContent",
  fetch_error: "fetchError",
  missing_status: "missingStatus",
  unexpected_status: "unexpectedStatus",
  missing_content_type: "missingContentType",
  robots_unknown: "robotsUnknown",
  parse_failed: "parseFailed",
};

export function indexabilityReasonLabel(
  page: PageRecord,
  messages: Messages["pages"],
): string {
  const labels = messages.indexability;
  const reason = page.indexabilityReason;
  const key = reason ? REASON_KEYS[reason] : undefined;
  if (key) return labels.reasons[key];
  if (reason) return reason.replaceAll("_", " ");
  if (page.indexability === "indexable") return labels.reasons.indexable;
  if (page.indexability === "unknown") return labels.evidenceUnavailable;
  return labels.legacyResult;
}
