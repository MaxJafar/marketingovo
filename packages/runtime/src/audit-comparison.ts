import { createHash } from "node:crypto";
import type {
  IssueInstance,
  Run,
  RunComparison,
  RunComparisonConfiguration,
  RunComparisonIssueChange,
  RunComparisonLinkChange,
  RunComparisonLinkGraph,
  RunComparisonLinkSnapshot,
  RunComparisonPageChange,
  Severity,
} from "@agentseoapp/contracts";
import type {
  StoredPageLinkEdge,
  StoredPageRecord,
  StoredRunLinkGraphSnapshot,
} from "@agentseoapp/storage-sqlite";

export interface RunMetricRecord {
  runId: string | null;
  key: string;
  metric: {
    value: number | null;
    state: string;
  };
}

export interface BuildAuditComparisonInput {
  baselineRun: Run;
  currentRun: Run;
  baselineOptions: Record<string, unknown>;
  currentOptions: Record<string, unknown>;
  baselineIssues: readonly IssueInstance[];
  currentIssues: readonly IssueInstance[];
  baselinePages: readonly StoredPageRecord[];
  currentPages: readonly StoredPageRecord[];
  baselineLinkGraph: StoredRunLinkGraphSnapshot;
  currentLinkGraph: StoredRunLinkGraphSnapshot;
  metrics: readonly RunMetricRecord[];
  generatedAt?: string;
}

const severityWeight: Record<Severity, number> = {
  critical: 8,
  high: 5,
  medium: 3,
  low: 1,
  info: 0,
};

const configurationGroups: ReadonlyArray<{
  label: string;
  paths: readonly string[];
}> = [
  {
    label: "Crawl scope",
    paths: [
      "mode",
      "scope",
      "exactUrls",
      "startUrls",
      "include",
      "exclude",
      "maxDepth",
      "crawl.scope",
      "crawl.exactUrls",
      "crawl.maxDepth",
    ],
  },
  {
    label: "Render and performance mode",
    paths: [
      "renderMode",
      "collectVitals",
      "crawl.renderMode",
      "performance.collectVitals",
    ],
  },
  {
    label: "Maximum URL limit",
    paths: ["maxUrls", "limit", "crawl.maxUrls"],
  },
  {
    label: "Extraction rule revision",
    paths: ["extractionRuleRevision"],
  },
  {
    label: "Private-network approval",
    paths: ["privateHostAllowlist"],
  },
];

function stableJson(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
    .join(",")}}`;
}

function configurationHash(options: Record<string, unknown>): string {
  return createHash("sha256")
    .update(
      stableJson({
        configurationVersion: 1,
        workflowId: "audit",
        options,
      }),
    )
    .digest("hex");
}

function pathValue(object: Record<string, unknown>, path: string): unknown {
  let value: unknown = object;
  for (const segment of path.split(".")) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return undefined;
    value = (value as Record<string, unknown>)[segment];
  }
  return value;
}

function selectedConfiguration(
  options: Record<string, unknown>,
  paths: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(
    paths
      .map((path) => [path, pathValue(options, path)] as const)
      .filter(([, value]) => value !== undefined),
  );
}

function compareConfiguration(
  baselineOptions: Record<string, unknown>,
  currentOptions: Record<string, unknown>,
): RunComparisonConfiguration {
  const baselineAvailable = Object.keys(baselineOptions).length > 0;
  const currentAvailable = Object.keys(currentOptions).length > 0;
  const baselineHash = baselineAvailable
    ? configurationHash(baselineOptions)
    : null;
  const currentHash = currentAvailable
    ? configurationHash(currentOptions)
    : null;
  if (!baselineAvailable && !currentAvailable) {
    return {
      state: "unavailable",
      baselineHash,
      currentHash,
      differences: [],
    };
  }
  if (baselineHash === currentHash) {
    return {
      state: "matched",
      baselineHash,
      currentHash,
      differences: [],
    };
  }
  const differences = configurationGroups
    .filter(
      (group) =>
        stableJson(selectedConfiguration(baselineOptions, group.paths)) !==
        stableJson(selectedConfiguration(currentOptions, group.paths)),
    )
    .map((group) => group.label);
  if (baselineAvailable !== currentAvailable) {
    differences.unshift("Stored configuration availability");
  }
  if (differences.length === 0) differences.push("Other stored options");
  return {
    state: "different",
    baselineHash,
    currentHash,
    differences,
  };
}

function isReviewedNoise(issue: IssueInstance): boolean {
  return issue.status === "ignored" || issue.status === "false_positive";
}

function issueChange(
  issue: IssueInstance,
  change: RunComparisonIssueChange["change"],
  baselineSeverity: Severity | null,
  currentSeverity: Severity | null,
): RunComparisonIssueChange {
  return {
    fingerprint: issue.fingerprint,
    ruleId: issue.ruleId,
    moduleId: issue.moduleId,
    canonicalUrl: issue.canonicalUrl,
    title: issue.title,
    change,
    baselineSeverity,
    currentSeverity,
  };
}

function issueChangePriority(change: RunComparisonIssueChange): number {
  return Math.max(
    change.baselineSeverity ? severityWeight[change.baselineSeverity] : 0,
    change.currentSeverity ? severityWeight[change.currentSeverity] : 0,
  );
}

function compareIssues(
  baselineIssues: readonly IssueInstance[],
  currentIssues: readonly IssueInstance[],
) {
  const effectiveBaseline = baselineIssues.filter(
    (issue) => !isReviewedNoise(issue),
  );
  const effectiveCurrent = currentIssues.filter(
    (issue) => !isReviewedNoise(issue),
  );
  const baselineByFingerprint = new Map(
    effectiveBaseline.map((issue) => [issue.fingerprint, issue]),
  );
  const currentByFingerprint = new Map(
    effectiveCurrent.map((issue) => [issue.fingerprint, issue]),
  );
  const regressions: RunComparisonIssueChange[] = [];
  const improvements: RunComparisonIssueChange[] = [];
  let persistent = 0;
  let severityIncreases = 0;
  let severityDecreases = 0;
  let score = 0;

  for (const current of effectiveCurrent) {
    const baseline = baselineByFingerprint.get(current.fingerprint);
    if (!baseline) {
      regressions.push(issueChange(current, "new", null, current.severity));
      score += severityWeight[current.severity];
      continue;
    }
    persistent += 1;
    const delta =
      severityWeight[current.severity] - severityWeight[baseline.severity];
    if (delta > 0) {
      severityIncreases += 1;
      regressions.push(
        issueChange(
          current,
          "severity_increased",
          baseline.severity,
          current.severity,
        ),
      );
      score += delta;
    } else if (delta < 0) {
      severityDecreases += 1;
      improvements.push(
        issueChange(
          current,
          "severity_decreased",
          baseline.severity,
          current.severity,
        ),
      );
      score += delta;
    }
  }
  for (const baseline of effectiveBaseline) {
    if (currentByFingerprint.has(baseline.fingerprint)) continue;
    improvements.push(
      issueChange(baseline, "resolved", baseline.severity, null),
    );
    score -= severityWeight[baseline.severity];
  }

  const ordered = (changes: RunComparisonIssueChange[]) =>
    changes.sort(
      (left, right) =>
        issueChangePriority(right) - issueChangePriority(left) ||
        (left.canonicalUrl ?? "").localeCompare(right.canonicalUrl ?? "") ||
        left.ruleId.localeCompare(right.ruleId),
    );

  return {
    effectiveBaseline,
    effectiveCurrent,
    regressions: ordered(regressions),
    improvements: ordered(improvements),
    persistent,
    severityIncreases,
    severityDecreases,
    reviewedExcludedBaseline: baselineIssues.length - effectiveBaseline.length,
    reviewedExcludedCurrent: currentIssues.length - effectiveCurrent.length,
    score,
  };
}

function pageSnapshot(page: StoredPageRecord) {
  return {
    statusCode: page.statusCode,
    title: page.title,
    indexable: page.indexable,
  };
}

function statusQuality(statusCode: number | null): number | null {
  if (statusCode === null) return null;
  if (statusCode >= 200 && statusCode < 300) return 4;
  if (statusCode >= 300 && statusCode < 400) return 3;
  if (statusCode >= 400 && statusCode < 500) return 2;
  if (statusCode >= 500 && statusCode < 600) return 1;
  return 0;
}

function statusImpact(
  before: number | null,
  after: number | null,
): RunComparisonPageChange["impact"] {
  const baseline = statusQuality(before);
  const current = statusQuality(after);
  if (baseline === null || current === null || baseline === current)
    return "neutral";
  return current < baseline ? "regression" : "improvement";
}

function indexabilityImpact(
  before: boolean | null,
  after: boolean | null,
): RunComparisonPageChange["impact"] {
  if (before === null || after === null || before === after) return "neutral";
  return before && !after ? "regression" : "improvement";
}

function comparePages(
  baselinePages: readonly StoredPageRecord[],
  currentPages: readonly StoredPageRecord[],
) {
  const baselineByUrl = new Map(
    baselinePages.map((page) => [page.canonicalUrl, page]),
  );
  const currentByUrl = new Map(
    currentPages.map((page) => [page.canonicalUrl, page]),
  );
  const urls = [
    ...new Set([...baselineByUrl.keys(), ...currentByUrl.keys()]),
  ].sort();
  const changes: RunComparisonPageChange[] = [];
  let added = 0;
  let removed = 0;
  let statusChanges = 0;
  let indexabilityChanges = 0;
  let score = 0;

  for (const canonicalUrl of urls) {
    const before = baselineByUrl.get(canonicalUrl);
    const after = currentByUrl.get(canonicalUrl);
    if (!before && after) {
      added += 1;
      changes.push({
        canonicalUrl,
        kind: "added",
        impact: "neutral",
        before: null,
        after: pageSnapshot(after),
      });
      continue;
    }
    if (before && !after) {
      removed += 1;
      changes.push({
        canonicalUrl,
        kind: "removed",
        impact: "neutral",
        before: pageSnapshot(before),
        after: null,
      });
      continue;
    }
    if (!before || !after) continue;
    if (before.statusCode !== after.statusCode) {
      statusChanges += 1;
      const impact = statusImpact(before.statusCode, after.statusCode);
      if (impact === "regression") score += 3;
      if (impact === "improvement") score -= 3;
      changes.push({
        canonicalUrl,
        kind: "status_changed",
        impact,
        before: pageSnapshot(before),
        after: pageSnapshot(after),
      });
    }
    if (before.indexable !== after.indexable) {
      indexabilityChanges += 1;
      const impact = indexabilityImpact(before.indexable, after.indexable);
      if (impact === "regression") score += 2;
      if (impact === "improvement") score -= 2;
      changes.push({
        canonicalUrl,
        kind: "indexability_changed",
        impact,
        before: pageSnapshot(before),
        after: pageSnapshot(after),
      });
    }
  }

  const impactOrder = { regression: 0, improvement: 1, neutral: 2 } as const;
  changes.sort(
    (left, right) =>
      impactOrder[left.impact] - impactOrder[right.impact] ||
      left.canonicalUrl.localeCompare(right.canonicalUrl) ||
      left.kind.localeCompare(right.kind),
  );
  return {
    changes,
    added,
    removed,
    statusChanges,
    indexabilityChanges,
    score,
  };
}

function linkSnapshot(edge: StoredPageLinkEdge): RunComparisonLinkSnapshot {
  return {
    targetPageUrl: edge.targetPageUrl,
    targetStatusCode: edge.targetStatusCode,
    targetIndexable: edge.targetIndexable,
    targetState: edge.targetState,
    occurrences: edge.occurrences,
    followOccurrences: edge.followOccurrences,
    nofollowOccurrences: edge.nofollowOccurrences,
    anchorTexts: [...edge.anchorTexts].sort(),
    placements: [...edge.placements].sort(),
  };
}

function linkKey(edge: StoredPageLinkEdge): string {
  return `${edge.sourceUrl}\u0000${edge.targetUrl}`;
}

function linkReasons(
  before: RunComparisonLinkSnapshot,
  after: RunComparisonLinkSnapshot,
): RunComparisonLinkChange["reasons"] {
  const reasons: RunComparisonLinkChange["reasons"] = [];
  if (
    before.targetPageUrl !== after.targetPageUrl ||
    before.targetStatusCode !== after.targetStatusCode ||
    before.targetState !== after.targetState
  ) {
    reasons.push("target_resolution");
  }
  if (before.targetIndexable !== after.targetIndexable) {
    reasons.push("target_indexability");
  }
  if (
    before.followOccurrences !== after.followOccurrences ||
    before.nofollowOccurrences !== after.nofollowOccurrences
  ) {
    reasons.push("follow_policy");
  }
  if (before.occurrences !== after.occurrences) {
    reasons.push("occurrences");
  }
  if (stableJson(before.anchorTexts) !== stableJson(after.anchorTexts)) {
    reasons.push("anchor_text");
  }
  if (stableJson(before.placements) !== stableJson(after.placements)) {
    reasons.push("placement");
  }
  return reasons;
}

function targetQuality(
  state: RunComparisonLinkSnapshot["targetState"],
): number | null {
  if (state === "direct") return 2;
  if (state === "redirected") return 1;
  if (state === "broken") return 0;
  return null;
}

function linkImpact(
  before: RunComparisonLinkSnapshot | null,
  after: RunComparisonLinkSnapshot | null,
): RunComparisonLinkChange["impact"] {
  if (!before && after) {
    return after.targetState === "broken" ? "regression" : "neutral";
  }
  if (before && !after) {
    return before.targetState === "broken" ? "improvement" : "neutral";
  }
  if (!before || !after) return "neutral";
  const baseline = targetQuality(before.targetState);
  const current = targetQuality(after.targetState);
  if (baseline === null || current === null || baseline === current) {
    return "neutral";
  }
  return current < baseline ? "regression" : "improvement";
}

function compareLinkGraphs(
  baseline: StoredRunLinkGraphSnapshot,
  current: StoredRunLinkGraphSnapshot,
): RunComparisonLinkGraph {
  const baselineByKey = new Map(
    baseline.items.map((edge) => [linkKey(edge), edge]),
  );
  const currentByKey = new Map(
    current.items.map((edge) => [linkKey(edge), edge]),
  );
  const keys = [
    ...new Set([...baselineByKey.keys(), ...currentByKey.keys()]),
  ].sort();
  const changes: RunComparisonLinkChange[] = [];
  let addedEdges = 0;
  let removedEdges = 0;
  let changedEdges = 0;

  for (const key of keys) {
    const baselineEdge = baselineByKey.get(key);
    const currentEdge = currentByKey.get(key);
    if (!baselineEdge && currentEdge) {
      addedEdges += 1;
      const after = linkSnapshot(currentEdge);
      changes.push({
        sourceUrl: currentEdge.sourceUrl,
        targetUrl: currentEdge.targetUrl,
        change: "added",
        impact: linkImpact(null, after),
        reasons: ["target_resolution"],
        before: null,
        after,
      });
      continue;
    }
    if (baselineEdge && !currentEdge) {
      removedEdges += 1;
      const before = linkSnapshot(baselineEdge);
      changes.push({
        sourceUrl: baselineEdge.sourceUrl,
        targetUrl: baselineEdge.targetUrl,
        change: "removed",
        impact: linkImpact(before, null),
        reasons: ["target_resolution"],
        before,
        after: null,
      });
      continue;
    }
    if (!baselineEdge || !currentEdge) continue;
    const before = linkSnapshot(baselineEdge);
    const after = linkSnapshot(currentEdge);
    const reasons = linkReasons(before, after);
    if (reasons.length === 0) continue;
    changedEdges += 1;
    changes.push({
      sourceUrl: currentEdge.sourceUrl,
      targetUrl: currentEdge.targetUrl,
      change: "changed",
      impact: linkImpact(before, after),
      reasons,
      before,
      after,
    });
  }

  const impactOrder = { regression: 0, improvement: 1, neutral: 2 } as const;
  changes.sort(
    (left, right) =>
      impactOrder[left.impact] - impactOrder[right.impact] ||
      left.sourceUrl.localeCompare(right.sourceUrl) ||
      left.targetUrl.localeCompare(right.targetUrl),
  );
  const state: RunComparisonLinkGraph["state"] =
    baseline.graphPageCount === 0 && current.graphPageCount === 0
      ? "unavailable"
      : baseline.graphPageCount === 0 ||
          current.graphPageCount === 0 ||
          baseline.graphPageCount < baseline.pageCount ||
          current.graphPageCount < current.pageCount
        ? "partial"
        : "available";
  const warnings: string[] = [];
  if (state === "unavailable") {
    warnings.push(
      "Neither audit contains versioned internal-link evidence. Replay both runs before interpreting graph changes.",
    );
  } else if (state === "partial") {
    warnings.push(
      "At least one audit has incomplete link-graph coverage, so edge changes are directional rather than exhaustive.",
    );
  }
  if (addedEdges > 0 || removedEdges > 0) {
    warnings.push(
      "Added and removed links remain neutral unless target evidence proves a broken-link regression or recovery; editorial intent still requires review.",
    );
  }
  if (
    changes.some(
      (change) =>
        change.before?.targetState === "uncrawled" ||
        change.after?.targetState === "uncrawled",
    )
  ) {
    warnings.push(
      "Uncrawled targets are not ranked as good or bad because destination health is unavailable.",
    );
  }

  return {
    version: "link-delta-v1",
    state,
    baseline: {
      pageCount: baseline.pageCount,
      graphPageCount: baseline.graphPageCount,
      edgeCount: baseline.items.length,
    },
    current: {
      pageCount: current.pageCount,
      graphPageCount: current.graphPageCount,
      edgeCount: current.items.length,
    },
    summary: {
      addedEdges,
      removedEdges,
      changedEdges,
      regressions: changes.filter((change) => change.impact === "regression")
        .length,
      improvements: changes.filter((change) => change.impact === "improvement")
        .length,
    },
    changes: changes.slice(0, 200),
    truncated: changes.length > 200,
    warnings,
  };
}

function healthForRun(
  metrics: readonly RunMetricRecord[],
  runId: string,
): number | null {
  const metric = [...metrics]
    .reverse()
    .find(
      (entry) => entry.runId === runId && entry.key === "seo_health",
    )?.metric;
  return metric?.state === "available" &&
    typeof metric.value === "number" &&
    Number.isFinite(metric.value)
    ? metric.value
    : null;
}

export function buildAuditComparison(
  input: BuildAuditComparisonInput,
): RunComparison {
  const configuration = compareConfiguration(
    input.baselineOptions,
    input.currentOptions,
  );
  const issues = compareIssues(input.baselineIssues, input.currentIssues);
  const pages = comparePages(input.baselinePages, input.currentPages);
  const linkGraph = compareLinkGraphs(
    input.baselineLinkGraph,
    input.currentLinkGraph,
  );
  const baselineHealth = healthForRun(input.metrics, input.baselineRun.id);
  const currentHealth = healthForRun(input.metrics, input.currentRun.id);
  const healthDelta =
    baselineHealth === null || currentHealth === null
      ? null
      : currentHealth - baselineHealth;
  const state =
    input.baselinePages.length === 0 && input.currentPages.length === 0
      ? "unavailable"
      : input.baselinePages.length === 0 ||
          input.currentPages.length === 0 ||
          input.baselineRun.status === "partial" ||
          input.currentRun.status === "partial"
        ? "partial"
        : "available";
  const warnings: string[] = [];
  if (configuration.state === "unavailable") {
    warnings.push(
      "Stored run configuration is unavailable, so crawl comparability cannot be verified.",
    );
  } else if (configuration.state === "different") {
    warnings.push(
      `Run configuration differs: ${configuration.differences.join(", ")}. Interpret URL-level changes with that scope difference in mind.`,
    );
  }
  if (state === "unavailable") {
    warnings.push(
      "Neither run contains a page snapshot. Issue changes remain visible, but page regressions cannot be calculated.",
    );
  } else if (state === "partial") {
    warnings.push(
      "At least one run is partial or lacks page evidence. Treat the comparison as directional rather than exhaustive.",
    );
  }
  if (
    issues.reviewedExcludedBaseline > 0 ||
    issues.reviewedExcludedCurrent > 0
  ) {
    warnings.push(
      "Ignored and false-positive findings were excluded from effective issue counts and deltas.",
    );
  }
  if (pages.indexabilityChanges > 0) {
    warnings.push(
      "Indexability changes require intent review: a deliberate noindex can be correct even when classified as a regression.",
    );
  }
  if (healthDelta === null) {
    warnings.push(
      "SEO Health was unavailable for one or both runs; no synthetic zero or health delta was created.",
    );
  }

  return {
    scoreVersion: "regression-v1",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    state,
    projectId: input.currentRun.projectId,
    baselineRun: input.baselineRun,
    currentRun: input.currentRun,
    configuration,
    summary: {
      baselinePages: input.baselinePages.length,
      currentPages: input.currentPages.length,
      addedPages: pages.added,
      removedPages: pages.removed,
      statusChanges: pages.statusChanges,
      indexabilityChanges: pages.indexabilityChanges,
      baselineIssues: issues.effectiveBaseline.length,
      currentIssues: issues.effectiveCurrent.length,
      newIssues: issues.regressions.filter((item) => item.change === "new")
        .length,
      resolvedIssues: issues.improvements.filter(
        (item) => item.change === "resolved",
      ).length,
      persistentIssues: issues.persistent,
      severityIncreases: issues.severityIncreases,
      severityDecreases: issues.severityDecreases,
      reviewedExcludedBaseline: issues.reviewedExcludedBaseline,
      reviewedExcludedCurrent: issues.reviewedExcludedCurrent,
      baselineHealth,
      currentHealth,
      healthDelta,
      regressionScore: issues.score + pages.score,
    },
    issueRegressions: issues.regressions.slice(0, 100),
    issueImprovements: issues.improvements.slice(0, 100),
    pageChanges: pages.changes.slice(0, 200),
    linkGraph,
    truncated: {
      issueRegressions: issues.regressions.length > 100,
      issueImprovements: issues.improvements.length > 100,
      pageChanges: pages.changes.length > 200,
    },
    warnings,
  };
}
