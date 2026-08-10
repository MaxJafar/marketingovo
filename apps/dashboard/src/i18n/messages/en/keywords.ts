/** Keyword lab: research workflows, provider usage, clusters, opportunities. */
export const keywords = {
  eyebrow: "Demand intelligence",
  title: "Keywords & content",
  description:
    "Find query opportunities, group intent, and turn search demand into a focused content plan.",
  starting: "Starting…",
  research: {
    title: "Research one market",
    description:
      "Expand a seed across suggestions, intent, Trends, PAA, and related searches.",
    seedLabel: "Seed keyword",
    start: "Start keyword research",
  },
  plan: {
    title: "Build a content plan",
    description:
      "Enter up to ten seed topics, separated by commas or new lines.",
    seedsLabel: "Seed topics",
    generate: "Generate content plan",
  },
  notStartedTitle: "Research could not start",
  queuedTitle: "Research queued",
  queuedBody:
    "The durable run is visible under Audits. This page will show the latest completed research result.",
  usage: {
    title: "Latest research provider usage",
    reported:
      "${cost} was reported by metered providers across {billable} billable request(s).",
    unreported:
      "{count} billable request(s) did not report a per-call cost and are not shown as zero.",
    allReported: "All billable calls in this result reported their cost.",
    free: "{count} completed request(s) used known-free sources.",
  },
  clusters: {
    title: "Content clusters",
    description:
      "Coverage and brief guidance from the connected keyword source.",
    keywordCount: "{count} keywords",
    coverage: "Content coverage",
    coverageUnavailable: "Coverage measurement unavailable",
    noBrief: "No brief recommendation available.",
    emptyTitle: "No content clusters",
    emptyBody:
      "Connect a keyword provider or import keyword data to build topic clusters.",
  },
  opportunities: {
    title: "Keyword opportunities",
    description:
      "Prioritize demand using position, search volume, difficulty, and opportunity score.",
    tableLabel: "Keyword opportunities",
    emptyTitle: "No keyword opportunities",
    emptyBody: "The API returned a valid empty opportunity set.",
    columns: {
      keyword: "Keyword",
      intent: "Intent",
      position: "Position",
      volume: "Volume",
      difficulty: "Difficulty",
      opportunity: "Opportunity",
      target: "Target page",
    },
    noCluster: "No cluster",
    openPage: "Open page",
    invalidUrl: "Invalid URL",
    unassigned: "Unassigned",
  },
} as const;
