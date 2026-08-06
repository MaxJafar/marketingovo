// Report vocabulary, as the engine layer sees it.
//
// `@marketingovo/contracts/reporting` is the authority and holds the TypeBox
// schemas the API validates against. Core deliberately does not depend on it —
// the engine is the layer below the API — so the shape is restated here, and a
// compile-time assignability check in the runtime keeps the two from drifting.

export type ReportAvailability =
  "available" | "partial" | "unavailable" | "failed";

export interface ReportMetric {
  key: string;
  label: string;
  /** Null unless the figure was actually measured. Never a substituted zero. */
  value: number | null;
  unit: string;
  currency: string | null;
  state: ReportAvailability;
  /** Only set when both periods were measured. */
  change: number | null;
  note: string | null;
}

export interface ReportSource {
  id: string;
  label: string;
  state: ReportAvailability;
  reason: string;
  observedAt: string | null;
}

/** A total the report will not compute, and the sentence that replaces it. */
export interface ReportRefusal {
  expected: string;
  explanation: string;
}

export interface ReportSection {
  id: "paid" | "organic" | "social" | "email" | "actions";
  title: string;
  state: ReportAvailability;
  summary: string;
  metrics: ReportMetric[];
  sources: ReportSource[];
  refusals: ReportRefusal[];
  breakdown: Array<{ label: string; metrics: ReportMetric[] }>;
}

export interface ReportPeriod {
  start: string;
  end: string;
  comparisonStart: string | null;
  comparisonEnd: string | null;
  timezone: string;
}

export interface MarketingReport {
  id: string;
  projectId: string;
  title: string;
  period: ReportPeriod;
  narrative: string | null;
  sections: ReportSection[];
  coverageGaps: Array<{
    source: string;
    reason: string;
    remedy: string | null;
  }>;
  generatedAt: string;
  brandRevision: number | null;
}
