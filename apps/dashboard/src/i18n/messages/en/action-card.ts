/**
 * The single-action card used on dashboard surfaces: decision factors, the
 * workflow control, and the evidence disclosure.
 */
export const actionCard = {
  fallbackCategory: "Action",
  rankLabel: "#{rank}",
  priorityBadge: "{priority} priority",
  priorityLabel: {
    critical: "critical",
    high: "high",
    medium: "medium",
    low: "low",
  },
  impactLabel: {
    high: "high",
    medium: "medium",
    low: "low",
  },
  effortLabel: {
    low: "low",
    medium: "medium",
    high: "high",
    small: "small",
    large: "large",
  },
  statusLabel: {
    open: "open",
    acknowledged: "acknowledged",
    in_progress: "in progress",
    resolved: "resolved",
  },
  factorsLabel: "Priority factors",
  impact: "Impact",
  effort: "Effort",
  confidence: "Confidence",
  priorityScore: "Priority score",
  workflowStatus: "Workflow status",
  workflowStatusFor: "Workflow status for {title}",
  savingStatus: "Saving status…",
  whyPrioritized: "Why this is prioritized",
  noPriorityExplanation: "The API did not provide a priority explanation.",
  evidenceSummary: "Evidence and scope",
  noEvidence: "No supporting evidence was returned for this action.",
} as const;
