// Campaign link vocabulary, as the engine layer sees it.
//
// `@marketingovo/contracts/campaign-links` is the authority and holds the
// TypeBox schemas the API validates against. Core deliberately does not depend
// on it — the engine is the layer below the API — so the shape is restated
// here, and a compile-time assignability check in the runtime keeps the two
// from drifting.

export interface UtmParameters {
  source: string;
  medium: string;
  campaign: string;
  term: string | null;
  content: string | null;
}

export type CampaignLinkFindingSeverity = "blocking" | "warning" | "advice";

export interface CampaignLinkFinding {
  rule: string;
  severity: CampaignLinkFindingSeverity;
  message: string;
  field: string | null;
  remedy: string | null;
}

export type QrErrorCorrection = "L" | "M" | "Q" | "H";

export type QrPlacement =
  "screen" | "print-handheld" | "print-poster" | "packaging" | "outdoor";

export type QrScanVerdict = "comfortable" | "tight" | "unscannable";

export interface QrPrintAdvice {
  version: number;
  moduleCount: number;
  errorCorrection: QrErrorCorrection;
  printedWidthMm: number;
  moduleSizeMm: number;
  verdict: QrScanVerdict;
  recommendedWidthMm: number;
  maxScanDistanceMm: number;
  contrastRatio: number;
  findings: CampaignLinkFinding[];
}
