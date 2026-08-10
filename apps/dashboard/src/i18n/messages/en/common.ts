/** Shared primitives: formatters, query states, capability gates, freshness. */
export const common = {
  unavailable: "Unavailable",
  noComparison: "No comparison available",
  vsPriorPeriod: "{change}% vs prior period",
  createWorkspaceTitle: "Create a workspace to begin",
  createWorkspaceBody:
    "A workspace holds your channels, research and notes. Create one to start — you can add a website later, or never.",
  loadingLabel: "Loading data",
  errorTitle: "Data is unavailable",
  errorFallback: "The API did not return this workspace.",
  errorHint:
    "No value has been replaced with zero. Check the local API and integration health.",
  tryAgain: "Try again",
  gateTitle: "This needs one more thing",
  gateHint:
    "Everything else in this workspace keeps working. Nothing here has been filled in with a placeholder.",
  freshness: {
    stale:
      "This view is using the latest available snapshot. Recent changes may not be included.",
    missing: "One or more sources have not supplied data for this view.",
    unavailable: "One or more sources could not be reached.",
    unknown: "The API did not provide a freshness guarantee for this response.",
    fresh: "The response includes source warnings.",
  },
  snapshot: "Snapshot: {time}",
  invalidSessionResponse:
    "The local service returned an invalid session response.",
  importTooLarge: "The .marketingovo file must be 25 MiB or smaller.",
  importWrongExtension: "Choose a file with the .marketingovo extension.",
  serviceUnreachable: "The local service is unreachable.",
  messageNotSent: "That message was not sent.",
  trendUnavailable: "Trend unavailable",
  trendEmptyBody:
    "At least two dated measurements are needed to draw a trustworthy trend.",
  historicalSignal: "Historical signal",
  observations: "{count} observations",
  trendRange: "{title}, from {min} to {max}",
} as const;
