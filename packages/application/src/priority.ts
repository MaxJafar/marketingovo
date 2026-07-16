import type { Action, Effort, Severity } from "@golem-seo/contracts";

export interface PriorityV1Input {
  severity: Severity | number;
  organicExposure: number | null;
  conversionExposure: number | null;
  urlReach: number;
  confidence: number;
  effort: Effort;
}

export interface PriorityV1Result {
  priorityScore: number;
  impact: number;
  scoreInputs: Action["scoreInputs"];
}

const severityValue: Record<Severity, number> = {
  critical: 1,
  high: 0.8,
  medium: 0.55,
  low: 0.3,
  info: 0.1,
};

const effortMultiplier: Record<Effort, number> = {
  low: 1,
  medium: 0.75,
  high: 0.5,
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * Recalculate priority-v1 from already normalized, confidence-adjusted inputs.
 * This is used when a marketer adjudicates only part of an action's URL scope:
 * reach changes, while the observed severity and provider evidence do not.
 */
export function priorityScoreV1FromInputs(
  inputs: Action["scoreInputs"],
  effort: Effort,
): number {
  const base =
    0.35 * clamp01(inputs.severity) +
    0.25 * (inputs.organicExposure ?? 0.5) +
    0.15 * (inputs.conversionExposure ?? 0.5) +
    0.15 * clamp01(inputs.urlReach) +
    0.1 * clamp01(inputs.confidence);
  return Math.round(clamp01(base * effortMultiplier[effort]) * 1000) / 10;
}

/**
 * Transparent priority-v1 scoring. Missing exposure data is not converted to
 * zero: it is replaced with a neutral estimate and explicitly recorded as
 * unavailable while confidence is reduced.
 */
export function scorePriorityV1(input: PriorityV1Input): PriorityV1Result {
  const unavailable: string[] = [];
  const severity = clamp01(
    typeof input.severity === "number"
      ? input.severity
      : severityValue[input.severity],
  );
  const organicExposure =
    input.organicExposure === null ? null : clamp01(input.organicExposure);
  const conversionExposure =
    input.conversionExposure === null
      ? null
      : clamp01(input.conversionExposure);
  if (organicExposure === null) unavailable.push("organic_exposure");
  if (conversionExposure === null) unavailable.push("conversion_exposure");

  const completenessPenalty = unavailable.length * 0.12;
  const confidence = clamp01(input.confidence * (1 - completenessPenalty));
  const organicForScore = organicExposure ?? 0.5;
  const conversionForScore = conversionExposure ?? 0.5;
  const urlReach = clamp01(input.urlReach);
  const scoreInputs: Action["scoreInputs"] = {
    severity,
    organicExposure,
    conversionExposure,
    urlReach,
    confidence,
    unavailable,
  };
  const priorityScore = priorityScoreV1FromInputs(scoreInputs, input.effort);

  return {
    priorityScore,
    impact:
      Math.round(
        clamp01(
          0.5 * severity + 0.3 * organicForScore + 0.2 * conversionForScore,
        ) * 1000,
      ) / 1000,
    scoreInputs,
  };
}
