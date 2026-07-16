/** Evidence-backed indexability classification shared by the engine and runtime. */
export type PageIndexabilityReason =
  | "indexable"
  | "robots_blocked"
  | "meta_noindex"
  | "x_robots_noindex"
  | "canonicalized"
  | "non_html"
  | "redirect"
  | "http_error"
  | "no_content"
  | "fetch_error"
  | "missing_status"
  | "unexpected_status"
  | "missing_content_type"
  | "robots_unknown"
  | "parse_failed";

export interface PageIndexabilityEvidence {
  status: number | null | undefined;
  finalUrl: string;
  contentType: string | null | undefined;
  canonical: string | null | undefined;
  robotsMeta: string | null | undefined;
  xRobotsTag: string | null | undefined;
  robotsAllowed: boolean | null | undefined;
  htmlParsed: boolean | null | undefined;
  error: string | null | undefined;
}

export interface PageIndexabilityAssessment {
  /** `null` means the crawl did not collect enough evidence to decide. */
  indexable: boolean | null;
  reason: PageIndexabilityReason;
}

const HTML_MEDIA_TYPES = new Set(["text/html", "application/xhtml+xml"]);

function mediaType(value: string): string {
  return value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function hasDirective(
  value: string | null | undefined,
  directive: string,
): boolean {
  if (!value) return false;
  const expected = directive.toLowerCase();
  return value
    .toLowerCase()
    .split(/[;,]/)
    .some((part) => part.trim().split(/\s+/).includes(expected));
}

function hasNoindexMeta(value: string | null | undefined): boolean {
  return hasDirective(value, "noindex") || hasDirective(value, "none");
}

function hasNoindexHeader(value: string | null | undefined): boolean {
  return (
    hasApplicableHeaderDirective(value, "noindex") ||
    hasApplicableHeaderDirective(value, "none")
  );
}

/**
 * X-Robots-Tag supports crawler-qualified directives. Only generic, wildcard,
 * and Googlebot directives affect the Google-oriented indexability signal.
 */
function hasApplicableHeaderDirective(
  value: string | null | undefined,
  directive: string,
): boolean {
  if (!value) return false;
  const expected = directive.toLowerCase();
  let applies = true;
  for (const rawPart of value.toLowerCase().split(/[;,]/)) {
    const part = rawPart.trim();
    if (!part) continue;
    const qualified = /^([a-z0-9*_-]+)\s*:\s*(.*)$/.exec(part);
    const isCrawlerQualifier =
      qualified !== null &&
      (qualified[1] === "*" || qualified[1]?.endsWith("bot") === true);
    const directives = isCrawlerQualifier ? (qualified[2] ?? "") : part;
    if (qualified && isCrawlerQualifier) {
      const crawler = qualified[1];
      applies = crawler === "*" || crawler === "googlebot";
    }
    if (applies && directives.split(/\s+/).includes(expected)) return true;
  }
  return false;
}

function comparableUrl(value: string, base?: string): string | null {
  try {
    const parsed = new URL(value, base);
    parsed.hash = "";
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Classify only from evidence collected during this crawl. The function never
 * turns missing evidence into a positive or negative result.
 */
export function assessPageIndexability(
  evidence: PageIndexabilityEvidence,
): PageIndexabilityAssessment {
  if (evidence.robotsAllowed === false) {
    return { indexable: false, reason: "robots_blocked" };
  }

  const status = evidence.status;
  if (status === null || status === undefined || status === 0) {
    return {
      indexable: null,
      reason: evidence.error ? "fetch_error" : "missing_status",
    };
  }
  if (status >= 300 && status < 400) {
    return { indexable: false, reason: "redirect" };
  }
  if (status >= 400 && status < 600) {
    return { indexable: false, reason: "http_error" };
  }
  if (status < 200 || status >= 600) {
    return { indexable: null, reason: "unexpected_status" };
  }
  if (status === 204 || status === 205) {
    return { indexable: false, reason: "no_content" };
  }
  if (evidence.error) {
    return { indexable: null, reason: "fetch_error" };
  }

  const type = mediaType(evidence.contentType ?? "");
  if (!type) {
    return { indexable: null, reason: "missing_content_type" };
  }
  if (!HTML_MEDIA_TYPES.has(type)) {
    return { indexable: false, reason: "non_html" };
  }
  if (hasNoindexHeader(evidence.xRobotsTag)) {
    return { indexable: false, reason: "x_robots_noindex" };
  }
  if (evidence.htmlParsed !== true) {
    return { indexable: null, reason: "parse_failed" };
  }
  if (hasNoindexMeta(evidence.robotsMeta)) {
    return { indexable: false, reason: "meta_noindex" };
  }

  const canonical = evidence.canonical?.trim();
  if (canonical) {
    const current = comparableUrl(evidence.finalUrl);
    const target = comparableUrl(canonical, evidence.finalUrl);
    // Invalid canonicals are ignored by crawlers and belong in the separate
    // canonical-quality issue stream. They are not proof of non-indexability.
    if (current && target && current !== target) {
      return { indexable: false, reason: "canonicalized" };
    }
  }

  // Missing robots evidence prevents a positive classification, but it must
  // not hide definitive noindex or canonical evidence handled above.
  if (evidence.robotsAllowed === null || evidence.robotsAllowed === undefined) {
    return { indexable: null, reason: "robots_unknown" };
  }

  return { indexable: true, reason: "indexable" };
}

export function dashboardIndexabilityStatus(
  assessment: PageIndexabilityAssessment,
): "indexable" | "blocked" | "noindex" | "canonicalized" | "unknown" {
  if (assessment.indexable === null) return "unknown";
  if (assessment.indexable) return "indexable";
  if (
    assessment.reason === "meta_noindex" ||
    assessment.reason === "x_robots_noindex"
  ) {
    return "noindex";
  }
  if (assessment.reason === "canonicalized") {
    return "canonicalized";
  }
  return "blocked";
}
