/** The reports library: exportable snapshots and their download formats. */
export const reports = {
  eyebrow: "Share outcomes",
  title: "Reports",
  description:
    "Keep stakeholders aligned with exportable snapshots and scheduled performance summaries.",
  typeFallback: "SEO report",
  generated: "Generated {date}",
  scheduledFor: "Scheduled for {date}",
  scheduleUnavailable: "Schedule unavailable",
  recipients: "Recipients: {list}",
  downloadGroupLabel: "Download {name}",
  downloadFormatLabel: "Download {format} report: {name}",
  downloadUnavailable: "Download unavailable",
  emptyTitle: "No reports yet",
  emptyDescription:
    "Generate reports through the API or configure a schedule once your baseline data is available.",
} as const;
