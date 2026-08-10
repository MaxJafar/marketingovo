/** Competitors: the comparison workflow and crawl-evidence cards. */
export const competitors = {
  eyebrow: "Market context",
  title: "Competitors",
  description:
    "Crawl evidence, publishing cadence and content gaps, all gathered from each rival's own site — no provider key required. Keyword-level gaps stay explicitly unavailable until a supporting provider supplies them.",
  form: {
    title: "Run a reproducible comparison",
    description:
      "Enter one or two competitor domains. Every site is crawled with the same limits; this view reports technical evidence, not invented visibility data.",
    domainsLabel: "Competitor domains",
    starting: "Starting…",
    submit: "Compare sites",
  },
  notStartedTitle: "Comparison could not start",
  queuedTitle: "Comparison queued",
  queuedBody:
    "The durable run is visible under Audits. This page will show the latest completed comparison.",
  card: {
    updated: "Updated {date}",
    publishesEvery: "Publishes every",
    cadenceDays: "{count} days",
    cadenceUnavailableHint:
      "No feed was found, or the feed carried too few dated posts to measure an interval.",
    lastPublished: "Last published",
    daysAgo: "{count} days ago",
    technicalHealth: "Technical health",
    change: "Change",
    changeUnavailableHint:
      "No earlier comparison includes this site, so there is no baseline to move against.",
    noChange: "No change",
    changePts: "{value} pts",
    sharedKeywords: "Shared keywords",
    keywordGaps: "Keyword gaps",
    coversGapTopics: "Covers gap topics",
  },
  emptyTitle: "No competitors configured",
  emptyBody:
    "Add competitor domains through the API or setup flow to unlock market context.",
  gaps: {
    title: "Topics they cover that you do not",
    description:
      "Derived from the pages themselves, so no keyword provider is required. Each term appears in the competitor pages at a materially higher density than on your site.",
    coverageOne: "on {covering} of {total} compared site",
    coverageMany: "on {covering} of {total} compared sites",
  },
} as const;
