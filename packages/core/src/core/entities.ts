import { createHash } from "node:crypto";
import type { Issue, Priority } from "../checks/index.js";
import type { ModuleId } from "../modules/types.js";

export type IssueSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface Evidence {
  kind: "rule" | "metric" | "source";
  summary: string;
  data?: Record<string, unknown>;
}

export interface IssueInstance {
  fingerprint: string;
  ruleId: string;
  moduleId: string;
  canonicalUrl: string | null;
  severity: IssueSeverity;
  evidence: Evidence[];
  firstSeenAt: string;
  lastSeenAt: string;
  status: "open" | "resolved" | "ignored" | "false_positive";
}

export interface Action {
  id: string;
  title: string;
  whyNow: string;
  impact: number;
  effort: "low" | "medium" | "high";
  confidence: number;
  priorityScore: number;
  scoreVersion: "priority-v1";
  affectedUrls: string[];
  owner: string | null;
  status: "open" | "acknowledged" | "in_progress" | "resolved";
  verification: "pending" | "verified" | "regressed";
}

export interface PriorityV1Input {
  severity: number;
  organicExposure: number;
  conversionExposure: number;
  urlReach: number;
  confidence: number;
  effort: Action["effort"];
}

const EFFORT_MULTIPLIER: Record<Action["effort"], number> = {
  low: 1,
  medium: 0.75,
  high: 0.5,
};

/** The public, reproducible priority-v1 formula. All inputs are 0..1. */
export function scorePriorityV1(input: PriorityV1Input): number {
  for (const [key, value] of Object.entries(input)) {
    if (key === "effort") continue;
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 1
    ) {
      throw new RangeError(
        `priority-v1 ${key} must be a finite number between 0 and 1`,
      );
    }
  }
  const base =
    0.35 * input.severity +
    0.25 * input.organicExposure +
    0.15 * input.conversionExposure +
    0.15 * input.urlReach +
    0.1 * input.confidence;
  return Math.round(100 * base * EFFORT_MULTIPLIER[input.effort] * 100) / 100;
}

export function canonicalizeIssueUrl(
  value: string | null | undefined,
): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    return url.href;
  } catch {
    return raw;
  }
}

export function issueFingerprint(
  moduleId: string,
  ruleId: string,
  canonicalUrl: string | null,
): string {
  return createHash("sha256")
    .update(`${moduleId}\u0000${ruleId}\u0000${canonicalUrl ?? "<site>"}`)
    .digest("hex");
}

export function issueToInstances(
  issue: Issue,
  fallbackModuleId: ModuleId,
  observedAt: string,
): IssueInstance[] {
  const moduleId = issue.moduleId ?? fallbackModuleId;
  const urls = issue.urls.length > 0 ? issue.urls : [null];
  return urls.map((url) => {
    const canonicalUrl = canonicalizeIssueUrl(url);
    return {
      fingerprint: issueFingerprint(moduleId, issue.id, canonicalUrl),
      ruleId: issue.id,
      moduleId,
      canonicalUrl,
      severity: priorityToSeverity(issue.priority),
      evidence: [{ kind: "rule", summary: issue.message, data: issue.detail }],
      firstSeenAt: observedAt,
      lastSeenAt: observedAt,
      status: "open",
    };
  });
}

function priorityToSeverity(priority: Priority): IssueSeverity {
  if (priority === "High") return "high";
  if (priority === "Medium") return "medium";
  return "low";
}
