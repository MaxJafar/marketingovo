import type { IssueInstance } from "@marketingovo/contracts";

export interface CohortPageMetric {
  url: string;
  clicks: number | null;
  impressions: number | null;
  keyEvents?: number | null;
}

export interface CohortMatch {
  targetUrl: string;
  controlUrl: string;
  templateMatched: boolean;
  distance: number;
}

export interface CohortSelection {
  targetUrls: string[];
  controlUrls: string[];
  matches: CohortMatch[];
  coverage: number;
  limitations: string[];
}

export interface TechnicalVerificationVerdict {
  state: "verified" | "regressed" | "inconclusive";
  coverage: number;
  remainingIssues: IssueInstance[];
  limitations: string[];
}

export interface ObservedCohortTotals {
  targetPre: number | null;
  targetPost: number | null;
  controlPre: number | null;
  controlPost: number | null;
  targetCoverage: number;
  controlCoverage: number;
}

export interface ControlAdjustedOutcome {
  state: "observed" | "inconclusive";
  targetChange: number | null;
  controlChange: number | null;
  controlAdjustedChange: number | null;
  confidence: number | null;
  limitations: string[];
}

function canonicalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    if (
      (url.protocol === "https:" && url.port === "443") ||
      (url.protocol === "http:" && url.port === "80")
    )
      url.port = "";
    return url.toString();
  } catch {
    return null;
  }
}

function pathShape(value: string): { template: string; depth: number } | null {
  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    const first = segments[0] ?? "_root";
    return {
      template: `${url.origin}/${first}/depth-${segments.length}`,
      depth: segments.length,
    };
  } catch {
    return null;
  }
}

function metricDistance(
  left: CohortPageMetric,
  right: CohortPageMetric,
): number {
  const clicks =
    Math.abs(Math.log1p(left.clicks ?? 0) - Math.log1p(right.clicks ?? 0)) *
    0.6;
  const impressions =
    Math.abs(
      Math.log1p(left.impressions ?? 0) - Math.log1p(right.impressions ?? 0),
    ) * 0.4;
  return clicks + impressions;
}

/**
 * Deterministically matches affected pages to unaffected pages with a similar
 * path shape and first-party demand. The result is observational context, not
 * a causal guarantee.
 */
export function selectMatchedControlCohort(
  targetUrls: readonly string[],
  pages: readonly CohortPageMetric[],
): CohortSelection {
  const targets = [...new Set(targetUrls.map(canonicalUrl).filter(Boolean))] as
    string[] | never[];
  const targetSet = new Set(targets);
  const metrics = new Map(
    pages.flatMap((page) => {
      const url = canonicalUrl(page.url);
      return url ? [[url, { ...page, url }] as const] : [];
    }),
  );
  const candidates = [...metrics.values()].filter(
    (page) => !targetSet.has(page.url),
  );
  const used = new Set<string>();
  const matches: CohortMatch[] = [];

  for (const targetUrl of targets) {
    const target = metrics.get(targetUrl);
    if (!target) continue;
    const shape = pathShape(targetUrl);
    const ranked = candidates
      .filter((candidate) => !used.has(candidate.url))
      .map((candidate) => {
        const candidateShape = pathShape(candidate.url);
        const templateMatched =
          shape !== null && candidateShape?.template === shape.template;
        const depthPenalty =
          shape === null || candidateShape === null
            ? 2
            : Math.abs(shape.depth - candidateShape.depth) * 0.75;
        return {
          candidate,
          templateMatched,
          distance:
            metricDistance(target, candidate) +
            (templateMatched ? 0 : 1.5) +
            depthPenalty,
        };
      })
      .sort(
        (left, right) =>
          left.distance - right.distance ||
          left.candidate.url.localeCompare(right.candidate.url),
      );
    const selected = ranked[0];
    if (!selected) continue;
    used.add(selected.candidate.url);
    matches.push({
      targetUrl,
      controlUrl: selected.candidate.url,
      templateMatched: selected.templateMatched,
      distance: Number(selected.distance.toFixed(6)),
    });
  }

  const coverage = targets.length === 0 ? 0 : matches.length / targets.length;
  const limitations: string[] = [];
  if (targets.length === 0)
    limitations.push("The action has no URL-level target cohort.");
  if (coverage < 0.8)
    limitations.push(
      "Fewer than 80% of target pages have a matched local control page.",
    );
  if (matches.some((match) => !match.templateMatched))
    limitations.push(
      "Some controls use a similar crawl depth because no same-template page was available.",
    );
  limitations.push(
    "Matched controls reduce obvious demand bias but do not prove causality.",
  );

  return {
    targetUrls: targets,
    controlUrls: matches.map((match) => match.controlUrl),
    matches,
    coverage,
    limitations,
  };
}

export function technicalVerificationVerdict(input: {
  targetUrls: readonly string[];
  crawledUrls: readonly string[];
  issues: readonly IssueInstance[];
  ruleId: string;
  moduleId: string;
}): TechnicalVerificationVerdict {
  const targets = new Set(
    input.targetUrls.map(canonicalUrl).filter((url): url is string => !!url),
  );
  const crawled = new Set(
    input.crawledUrls.map(canonicalUrl).filter((url): url is string => !!url),
  );
  const covered = [...targets].filter((url) => crawled.has(url)).length;
  const coverage = targets.size === 0 ? 0 : covered / targets.size;
  const remainingIssues = input.issues.filter((issue) => {
    if (issue.ruleId !== input.ruleId || issue.moduleId !== input.moduleId)
      return false;
    return issue.canonicalUrl === null
      ? targets.size === 0
      : targets.has(canonicalUrl(issue.canonicalUrl) ?? "");
  });
  const limitations: string[] = [];
  if (targets.size === 0)
    limitations.push("This action has no exact URL cohort to verify.");
  if (coverage < 1)
    limitations.push(
      `The targeted crawl covered ${covered} of ${targets.size} URLs.`,
    );
  if (targets.size === 0 || coverage < 1)
    return {
      state: "inconclusive",
      coverage,
      remainingIssues,
      limitations,
    };
  if (remainingIssues.length > 0)
    return { state: "regressed", coverage, remainingIssues, limitations };
  return { state: "verified", coverage, remainingIssues, limitations };
}

export function calculateControlAdjustedOutcome(
  input: ObservedCohortTotals,
): ControlAdjustedOutcome {
  const limitations = [
    "This is a control-adjusted observed change, not proof of causality.",
  ];
  const values = [
    input.targetPre,
    input.targetPost,
    input.controlPre,
    input.controlPost,
  ];
  if (values.some((value) => value === null)) {
    limitations.push(
      "One or more required cohort measurements are unavailable.",
    );
    return {
      state: "inconclusive",
      targetChange: null,
      controlChange: null,
      controlAdjustedChange: null,
      confidence: null,
      limitations,
    };
  }
  if ((input.targetPre ?? 0) <= 0 || (input.controlPre ?? 0) <= 0) {
    limitations.push(
      "Baseline target and control values must both be greater than zero.",
    );
    return {
      state: "inconclusive",
      targetChange: null,
      controlChange: null,
      controlAdjustedChange: null,
      confidence: null,
      limitations,
    };
  }
  if (input.targetCoverage < 0.8 || input.controlCoverage < 0.8) {
    limitations.push("Target or control coverage is below 80%.");
    return {
      state: "inconclusive",
      targetChange: null,
      controlChange: null,
      controlAdjustedChange: null,
      confidence: null,
      limitations,
    };
  }
  const targetChange = input.targetPost! / input.targetPre! - 1;
  const controlChange = input.controlPost! / input.controlPre! - 1;
  const controlAdjustedChange = targetChange - controlChange;
  const sampleConfidence = Math.min(
    1,
    Math.log10(input.targetPre! + input.controlPre! + 1) / 3,
  );
  const confidence = Math.min(
    input.targetCoverage,
    input.controlCoverage,
    sampleConfidence,
  );
  return {
    state: "observed",
    targetChange,
    controlChange,
    controlAdjustedChange,
    confidence,
    limitations,
  };
}
