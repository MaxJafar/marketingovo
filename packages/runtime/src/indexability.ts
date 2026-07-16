import {
  assessPageIndexability,
  type PageIndexabilityAssessment,
} from "@golem-seo/core";

export interface EnginePageIndexabilityEvidence {
  status: number;
  finalUrl: string;
  contentType?: string | null;
  canonical?: string | null;
  robotsMeta?: string | null;
  xRobotsTag?: string | null;
  robotsAllowed?: boolean | null;
  htmlParsed?: boolean | null;
  error?: string | null;
}

export interface PageIndexabilitySummary {
  assessments: PageIndexabilityAssessment[];
  indexablePages: number;
  knownPages: number;
  totalPages: number;
  /** Ratio among pages that have sufficient evidence; null means unavailable. */
  value: number | null;
  /** Share of crawled pages with a definitive classification. */
  coverage: number;
}

export function assessEnginePageIndexability(
  page: EnginePageIndexabilityEvidence,
): PageIndexabilityAssessment {
  return assessPageIndexability({
    status: page.status,
    finalUrl: page.finalUrl,
    contentType: page.contentType,
    canonical: page.canonical,
    robotsMeta: page.robotsMeta,
    xRobotsTag: page.xRobotsTag,
    robotsAllowed: page.robotsAllowed,
    htmlParsed: page.htmlParsed,
    error: page.error,
  });
}

export function summarizePageIndexability(
  pages: readonly EnginePageIndexabilityEvidence[],
): PageIndexabilitySummary {
  const assessments = pages.map(assessEnginePageIndexability);
  let knownPages = 0;
  let indexablePages = 0;
  for (const assessment of assessments) {
    if (assessment.indexable === null) continue;
    knownPages += 1;
    if (assessment.indexable) indexablePages += 1;
  }
  return {
    assessments,
    indexablePages,
    knownPages,
    totalPages: pages.length,
    value: knownPages > 0 ? indexablePages / knownPages : null,
    coverage: pages.length > 0 ? knownPages / pages.length : 0,
  };
}
