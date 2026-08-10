/**
 * The Actions workbench: queue filters, the prioritized table, and the
 * marketer workflow controls.
 */
export const actions = {
  eyebrow: "Evidence-to-outcome workbench",
  title: "Actions",
  description:
    "Prioritize, investigate, assign, and verify SEO work without separating technical evidence from business exposure.",
  statusNotSavedTitle: "Action status was not saved",
  filterTitle: "Find the work that matters now",
  filterDescription:
    "Search by recommendation, rule, module, or owner. Missing evidence stays unavailable and never becomes zero.",
  resetFilters: "Reset filters",
  searchLabel: "Search actions",
  searchPlaceholder: "Canonical, broken links, owner…",
  statusFilterLabel: "Status",
  allStatuses: "All statuses",
  verificationFilterLabel: "Verification",
  allVerification: "All verification",
  effortFilterLabel: "Effort",
  allEffort: "All effort",
  effortOption: {
    low: "Low",
    medium: "Medium",
    high: "High",
  },
  sortByLabel: "Sort by",
  sortOption: {
    priority: "Priority score",
    updated: "Most recently updated",
    affected: "Affected URLs",
    confidence: "Confidence",
  },
  priorityLegend: "Priority",
  priorityGroupLabel: "Filter actions by priority",
  priorityFilter: {
    all: "All",
    critical: "Critical",
    high: "High",
    medium: "Medium",
    low: "Low",
  },
  showingCount: "Showing {visible} of {total} actions",
  tableLabel: "Prioritized SEO actions",
  columnPriority: "Priority",
  columnAction: "Action and evidence group",
  columnScope: "Scope",
  columnEffort: "Effort",
  columnConfidence: "Confidence",
  columnWorkflow: "Workflow",
  columnVerification: "Verification",
  columnUpdated: "Updated",
  statusLabel: {
    open: "open",
    acknowledged: "acknowledged",
    in_progress: "in progress",
    resolved: "resolved",
  },
  verificationLabel: {
    pending: "pending",
    verified: "verified",
    regressed: "regressed",
  },
  moduleUnavailable: "Module unavailable",
  ruleUnavailable: "Rule unavailable",
  affectedUrls: "affected URLs",
  organicVisitsExposed: "{count} organic visits exposed",
  businessExposureUnavailable: "Business exposure unavailable",
  workflowStatusFor: "Workflow status for {title}",
  saving: "Saving…",
  emptyFilteredTitle: "No actions match these filters",
  emptyFilteredDescription:
    "Reset one or more filters to return to the complete evidence-backed queue.",
  emptyQueueTitle: "No prioritized actions yet",
  emptyQueueDescription:
    "Run an audit to generate the first action queue. A valid empty result is never presented as a perfect score.",
} as const;
