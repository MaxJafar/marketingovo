/**
 * The cross-channel report: generation, stored snapshots, section panels,
 * charts, and coverage gaps. Conventions in shell.ts.
 */
export const marketingReport = {
  stateLabel: {
    available: "complete",
    partial: "partial coverage",
    unavailable: "not measured",
    failed: "could not be read",
  },
  breakdownTitle: {
    paid: "Spend by account and platform",
    social: "Posts published by platform",
    competitors: "Public signals by competitor",
  },
  changeVsPrevious: "{change}% vs previous period",
  notMeasuredPeriod: "Not measured in this period.",
  compareHeading: "This period against the one before it",
  fellToZero:
    "Fell to zero against the previous period; the pair cannot be drawn from the stored figures.",
  notDrawn: "Not drawn — {label}: {reason}",
  breakdownHeading: "Breakdown",
  notMeasuredCell: "not measured",
  sourcesPrefix: "Sources:",
  sourceEntry: "{label} ({state}{reason})",
  noNarrative:
    "No narrative yet. Write one, or ask an attached agent to — a summary assembled from the numbers reads as insight while being arithmetic, so this is deliberately not generated.",
  openClientVersion: "Open the client version",
  plainText: "Plain text",
  downloadPdf: "Download PDF",
  gapsHeading: "What this report could not see",
  gapsBody:
    "Gathered here as well as in each section, so a reader who skims the numbers still meets the gaps.",
  generateHeading: "Generate a report",
  periodStart: "Period start",
  periodEnd: "Period end",
  gathering: "Gathering…",
  generate: "Generate",
  description:
    "Spans paid, organic search, social publishing, email, the competitive landscape and completed work — with charts for what was measured and a downloadable PDF. Leave the dates empty for the last complete 30 days — the current day is excluded because providers restate it.",
  generateFailed: "The report could not be generated.",
  generatedOn: "· generated {date}",
  empty:
    "No reports yet. A stored report is a frozen snapshot — figures are as each platform reported them on the day, and are not restated afterwards.",
} as const;
