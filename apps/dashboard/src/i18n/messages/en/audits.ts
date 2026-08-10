/** The audits page: run launcher, private-site approval, crawl history. */
export const audits = {
  eyebrow: "Crawl history",
  title: "Audits",
  description:
    "Start a baseline, follow active crawls, and compare completed technical snapshots.",
  starting: "Starting…",
  runFullAudit: "Run full audit",
  privateAccess: {
    summary: "Private-site access",
    allowTitle:
      "Allow this exact hostname to access a private network for this audit",
    allowHelp:
      "{host} only. This approval applies to audits started from this page until you switch projects; cloud metadata always stays blocked.",
  },
  scope: {
    summary: "Expert audit scope",
    title: "Audit an exact URL cohort",
    body: "Paste one absolute URL per line. Marketingovo crawls only this list and keeps each URL as a seed, which is useful for migrations, templates, QA samples, and verification runs.",
    urlListLabel: "URL list",
    urlListHelp:
      "URLs must use the project origin. Fragments and duplicates are removed before the run starts.",
    errorTitle: "URL cohort needs attention",
    submit: "Run URL list audit",
    atLeastOneUrl: "Add at least one absolute URL.",
    invalidUrl: "Invalid URL: {url}",
    unsupportedScheme: "Unsupported URL scheme: {scheme}",
  },
  startErrorTitle: "Audit could not start",
  queuedTitle: "Audit queued",
  queuedBody: "The API accepted the run. Refresh or watch the status below.",
  columns: {
    started: "Started",
    status: "Status",
    trigger: "Trigger",
    pagesCrawled: "Pages crawled",
    issues: "Issues",
    healthScore: "Health score",
  },
  tableLabel: "Audit runs",
  emptyTitle: "No audit runs yet",
  emptyBody:
    "Start a full baseline audit to populate crawl history and prioritized actions.",
} as const;
