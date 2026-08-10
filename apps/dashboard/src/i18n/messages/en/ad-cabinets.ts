/**
 * Ad Cabinets — connections, linked cabinets, stored performance, wasted
 * queries, and the spend-approval queue. Conventions in shell.ts.
 */
export const adCabinets = {
  platformLabel: {
    all: "All placements",
    facebook: "Facebook",
    instagram: "Instagram",
    messenger: "Messenger",
    audience_network: "Audience Network",
    google_search: "Google Search",
    google_search_partners: "Search Partners",
    google_display: "Google Display",
    google_youtube: "YouTube",
    google_performance_max: "Performance Max",
    unknown: "Other placement",
  },
  metricLabel: {
    spend: "Spend",
    impressions: "Impressions",
    clicks: "Clicks",
    link_clicks: "Link clicks",
    conversions: "Conversions",
    conversion_value: "Conversion value",
    cost_per_conversion: "Cost per conversion",
    ctr: "CTR",
    cpc: "CPC",
    cpm: "CPM",
    reach: "Reach",
    frequency: "Frequency",
    video_plays: "Video plays",
  },
  state: {
    partial: "partial — {observed}/{requested} days",
    failed: "could not read",
    unavailable: "not measured",
  },
  performance: {
    loading: "Reading stored measurements…",
    unreadable: "This cabinet's measurements could not be read.",
    neverSynced:
      "Never synced. Run a paid audit to read this cabinet's spend and delivery. Nothing is shown until something is measured.",
    syncedRange: "{start} to {end}. Last synced {date}.",
    metricHeader: "Metric",
    valueHeader: "Value",
    coverageHeader: "Coverage",
    coverageComplete: "complete",
    metricNote: "{metric}: {note}",
  },
  wasted: {
    heading: "Queries worth a decision",
    loading: "Reading stored search terms…",
    empty: "No search terms stored for this account yet. Run a paid audit.",
    queryHeader: "Query",
    matchedHeader: "Matched",
    clicksHeader: "Clicks",
    costHeader: "Cost",
    conversionsHeader: "Conversions",
    footnote:
      "Search and Shopping only. Performance Max and Demand Gen report no queries at all, and Google withholds terms too rare to anonymise, so this never accounts for all of an account's clicks. A short list is not evidence that nothing is being wasted.",
  },
  queue: {
    heading: "Waiting for your approval",
    empty:
      "Nothing is waiting for approval. An attached agent can draft a campaign and stage it here; it cannot approve one, and neither can this product send anything to an ad platform yet. Google Ads is read-only by design — see ADR 0008.",
    perDay: "{amount} per day",
    lifetime: "{amount} lifetime",
    noBudget: "No budget named",
    stagedOne:
      "{count} staged payload. Read the exact request before approving — approval binds to this version, and a payload edited afterwards has to be approved again.",
    stagedMany:
      "{count} staged payloads. Read the exact request before approving — approval binds to this version, and a payload edited afterwards has to be approved again.",
    stagedBy: "Staged by {name} on {date}. Payload {hash}…",
    hidePayload: "Hide payload",
    readPayload: "Read payload",
    readBeforeApproving: "Read the payload before approving it.",
    approveExact: "Approve this exact payload",
    withdraw: "Withdraw",
    approvalRefused: "The approval was refused.",
    footnote:
      "Approving records your consent to this exact payload. It does not send anything: this build has no outbound write path to Meta, by design.",
  },
  connections: {
    heading: "Connections",
    integrationsLink: "Integrations",
    metaExpiredBefore:
      "The Meta access token expired. Meta System User tokens have a fixed lifetime and do not refresh — generate a new one in Business Manager and paste it in",
    metaExpiredAfter:
      ". Until then, spend and delivery are unreadable rather than zero.",
    metaConnectedExpiry:
      "Meta is connected. The token expires {date} — rotate it before then.",
    metaConnected: "Meta is connected.",
    metaMissingBefore:
      "Meta is not connected, so Facebook and Instagram spend cannot be read. Generate a System User token in Meta Business Manager and paste it in",
    metaMissingAfter: ".",
    googleExpiredBefore:
      "The Google sign-in for Google Ads expired. Reconnect it in",
    googleExpiredAfter:
      ". Until then, Google spend is unreadable rather than zero.",
    googleConnected: "Google Ads is connected.",
    googleMissingBefore:
      "Google Ads is not connected. It needs two things: a Google sign-in, and a developer token of your own from the API Center of a Google Ads manager account. Marketingovo ships no developer token — one compiled into the app would make every install a single identity to Google, and its rate limits and terms attach to whoever holds it. Google approves new tokens by hand, so apply before you need it. Both go in",
    googleMissingAfter: ".",
  },
  cabinets: {
    heading: "Ad cabinets",
    providerSelectLabel: "Provider to search for accounts",
    asking: "Asking {provider}…",
    findAccounts: "Find my accounts",
    starting: "Starting…",
    runPaidAudit: "Run paid audit",
    auditCheckBefore:
      "The paid audit also checks the pages these ads send people to — destinations that 404, redirects that drop the click identifier, and landing pages that never mention what is being bid on. Findings appear in",
    actionsLink: "Actions",
    auditCheckAfter:
      ". Running an SEO audit first makes the check cheaper and adds page speed to it; without one, every destination is fetched directly.",
    empty:
      "No ad account is linked to this workspace. One login usually reaches several accounts, and which of them this workspace reads is your decision — connecting a provider links nothing on its own.",
    billsIn: "bills in {currency}",
    noCurrency: "no currency reported for this account",
    dailyCap: "daily cap {cap}",
    noDailyCap: "no local daily cap set",
    hidePerformance: "Hide performance",
    showPerformance: "Show performance",
    archive: "Archive",
    remove: "Remove",
    removeTitle:
      "Removes the cabinet and every measurement recorded against it.",
    discoveryFailed: "{provider} could not be reached for account discovery.",
    discoveredHeading: "Accounts this credential can reach",
    linked: "Linked",
    linkToWorkspace: "Link to this workspace",
  },
} as const;
