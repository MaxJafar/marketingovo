/** The decision-center overview: health hero, metric grid, source health. */
export const overview = {
  eyebrow: "Decision center",
  siteTitle: "{name} overview",
  fallbackTitle: "Your marketing overview",
  description:
    "See what changed, what matters, and which move is most likely to improve results.",
  startingAudit: "Starting audit…",
  runFullAudit: "Run full audit",
  auditNotStartedTitle: "Audit could not start",
  auditQueuedTitle: "Audit queued",
  auditQueuedBody:
    "The audit was accepted. Track progress from the Audits workspace.",
  health: {
    eyebrow: "Site health",
    title: "A clear baseline for your next decision",
    body: "The health score combines the signals returned by your configured audit sources. Missing inputs remain visible.",
    reviewActions: "Review prioritized actions",
    currentScore: "Current score",
    pointsVsPriorAudit: "{change} health points vs prior audit",
    comparisonUnavailable: "Comparison unavailable",
  },
  regressions: {
    eyebrow: "Watch now",
    title: "Critical regressions",
    body: "Issues that may need immediate triage.",
    openQueue: "Open action queue",
  },
  performance: {
    title: "Performance at a glance",
    description:
      "Marketing outcomes and technical coverage, without turning missing data into zero.",
    organicClicks: "Organic clicks",
    organicClicksHelp: "Connect Search Console for comparisons",
    organicKeyEvents: "Organic key events",
    organicKeyEventsHelp: "Connect GA4 to measure organic outcomes",
    indexableCoverage: "Indexable coverage",
    coreWebVitalsPassRate: "Core Web Vitals pass rate",
  },
  topActions: {
    title: "Top 5 actions",
    description:
      "Ranked by estimated impact, effort, confidence, and the evidence supplied by the API.",
    viewAll: "View all actions",
    emptyTitle: "No prioritized actions yet",
    emptyDescription:
      "Run a baseline audit after connecting your data sources. A valid empty result is shown as empty—not as a perfect score.",
  },
  trendTitle: "Health score trend",
  sources: {
    title: "Data source health",
    description: "Know which inputs support this view.",
    manage: "Manage",
    updated: "Updated {date}",
    coverage: "{value}% coverage",
    unavailableTitle: "Source status unavailable",
    unavailableBody:
      "The API did not identify the sources behind this overview.",
  },
} as const;
