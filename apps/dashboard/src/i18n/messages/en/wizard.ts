/** Workspace setup wizard: five linear steps from empty install to first runs. */
export const wizard = {
  eyebrow: "Setup",
  title: "Create your marketing workspace",
  description:
    "Five steps to a dashboard with real data. Only a brand name is required.",
  progressLabel: "Setup progress",
  optional: "Optional",
  errorTitle: "That step could not be saved",
  genericError: "Something went wrong.",
  launchError: "Could not start runs.",
  back: "Back",
  continue: "Continue",
  saving: "Saving…",
  starting: "Starting…",
  startRuns: "Start the first runs",
  goToDashboard: "Go to the dashboard",
  steps: {
    workspace: { label: "Workspace", hint: "Name the brand." },
    brand: { label: "Brand presence", hint: "Where else the brand lives." },
    competitors: { label: "Competitors", hint: "Who to measure against." },
    data: { label: "Data sources", hint: "Optional. Skippable." },
    launch: { label: "Review", hint: "Start the first runs." },
  },
  providers: {
    googleSearchConsole: {
      label: "Google Search Console",
      why: "Ranks findings by the queries and pages that actually earn impressions.",
      field: "Property URL or sc-domain identifier",
    },
    googleAnalytics4: {
      label: "Google Analytics 4",
      why: "Weights findings by sessions and conversions rather than severity alone.",
      field: "Property ID",
    },
    pagespeedInsights: {
      label: "PageSpeed Insights",
      why: "Adds field Core Web Vitals to the technical audit.",
      field: "API key",
    },
    serpapi: {
      label: "SerpAPI",
      why: "Required for live rank tracking. Without it, positions stay unmeasured.",
      field: "API key",
    },
  },
  runs: {
    baselineAudit: "Baseline audit",
    competitorComparison: "Competitor comparison",
    osintDossier: "Public-web OSINT dossier",
  },
  workspace: {
    title: "What are we tracking?",
    description:
      "The workspace is named for the brand. Add a website only if you want it crawled.",
    brandName: "Brand name",
    website: "Website",
    websiteHelp:
      "Needed only for crawling and SEO audits. Social, ads and research work without it, and you can add one later from Settings. https:// is added if you leave it off.",
    summaryLabel: "What does this brand do?",
    summaryHelp:
      "Recorded as workspace context so reports and agents share the same background.",
  },
  brand: {
    title: "Where else does the brand live?",
    description:
      "Each profile is checked against your crawl: whether any page links to it, and whether it is declared in schema.org sameAs. An unlinked profile is invisible to search engines.",
    label: "Label",
    profileUrl: "Profile URL",
    removeProfile: "Remove profile {number}",
    remove: "Remove",
    addProfile: "Add another profile",
  },
  competitors: {
    title: "Who are you measured against?",
    description:
      "Every competitor is crawled with the same limits as your own site. Publishing cadence and content gaps come from their pages, so no provider key is needed.",
    domains: "Competitor domains",
    domainsHelp:
      "One per line. The first two are compared in the opening run; the rest are kept in workspace context.",
  },
  data: {
    title: "Connect your data",
    description:
      "Every one of these is optional. Skip them and the audit still runs — findings are ranked by technical severity and reach, and anything that needs a source is reported as unavailable rather than guessed.",
    storageTitle: "Where these are stored",
    storageBody:
      "Credentials go to the local credential vault on this machine and are never written into reports, logs or artifacts.",
  },
  launch: {
    title: "Ready to run",
    description:
      "The baseline audit, competitor comparison, and optional public-web OSINT pass are queued together.",
    brand: "Brand",
    unnamed: "Unnamed",
    website: "Website",
    notSet: "Not set",
    brandProfiles: "Brand profiles",
    noProfiles: "None — brand presence will not be checked",
    competitors: "Competitors",
    noCompetitors: "None — Market intel stays empty",
    dataSources: "Data sources",
    providersConfigured: "{count} configured",
    noProviders: "None — findings ranked by severity and reach only",
    osint: "Public-web OSINT",
    osintIncluded: "Included — cited public signals and repeat-pass history",
    osintSkippedPrivate: "Skipped — public target required",
    osintSkippedChoice: "Skipped by choice",
    integrationsDetected: "Integrations detected",
    integrationsAvailable: "{count} available",
    checking: "Checking…",
    osintLabel: "Include the public-web OSINT dossier",
    osintHelp:
      "Recommended. Uses only this site and the explicit competitor URLs above, with source links, availability states, and no people-search, authenticated scraping, or dark-web collection. Private or loopback competitor URLs are excluded.",
    osintOff:
      "OSINT stays off for {host}; it is limited to public targets. The baseline can still run with the private-host authorization above.",
    privateTitle: "This run targets a private address",
    privateBodyOne:
      "{hosts} is on a private or loopback network. The crawler refuses these unless you authorize them for this workspace.",
    privateBodyMany:
      "{hosts} are on a private or loopback network. The crawler refuses these unless you authorize them for this workspace.",
    allowOne:
      "Allow crawling this host. Only these exact hosts are authorized; the rest of the private network stays blocked.",
    allowMany:
      "Allow crawling these hosts. Only these exact hosts are authorized; the rest of the private network stays blocked.",
    startedTitle: "Runs started",
    queuedJoiner: " and ",
    queued:
      "{runs} queued. Progress is visible under Audits; this workspace fills in as each run completes.",
  },
} as const;
