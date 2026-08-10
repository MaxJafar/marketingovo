import type {
  CampaignLinkFinding,
  QrPlacement,
  QrPrintAdvice,
  UtmParameters,
} from "@marketingovo/contracts/campaign-links";
import type {
  CampaignLinkFinding as EngineCampaignLinkFinding,
  QrPlacement as EngineQrPlacement,
  QrPrintAdvice as EngineQrPrintAdvice,
  UtmParameters as EngineUtmParameters,
} from "@marketingovo/core";

/**
 * Keeping the engine and the API in step.
 *
 * Core is the layer below the contracts package and cannot import from it, so
 * the campaign-link shapes are declared twice. These assignments are the check
 * that the two never drift: a renamed or retyped field stops this file
 * compiling rather than silently dropping data on the way to storage.
 *
 * They are types only and compile to nothing.
 */

const _findingMatches: CampaignLinkFinding =
  null as never as EngineCampaignLinkFinding;
const _adviceMatches: QrPrintAdvice = null as never as EngineQrPrintAdvice;
const _utmMatches: UtmParameters = null as never as EngineUtmParameters;
const _placementMatches: QrPlacement = null as never as EngineQrPlacement;

void _findingMatches;
void _adviceMatches;
void _utmMatches;
void _placementMatches;

/**
 * The severities a link can be refused for.
 *
 * Only `blocking` refuses. The distinction matters at the boundary: warnings
 * and advice are stored with the link so they surface next to it later, while
 * a blocking finding means the tagging would lose data and there is no useful
 * version of that to save.
 */
export const REFUSING_SEVERITIES: readonly CampaignLinkFinding["severity"][] = [
  "blocking",
];

export function hasBlockingFinding(
  findings: readonly CampaignLinkFinding[],
): boolean {
  return findings.some((finding) =>
    REFUSING_SEVERITIES.includes(finding.severity),
  );
}
