/** The local runtime page: overall status, uptime, and component checks. */
export const systemHealth = {
  eyebrow: "Local runtime",
  title: "System health",
  description:
    "Verify the dashboard API, storage, workers, and external connectors before trusting a reporting snapshot.",
  overallStatus: "Overall status",
  statusHealthy: "All reported systems operational",
  statusDegraded: "Some services need attention",
  statusOffline: "Local API reports an outage",
  statusUnknown: "Status is unknown",
  version: "Version",
  uptime: "Uptime",
  uptimeDaysHours: "{days}d {hours}h",
  uptimeHours: "{hours}h",
  checked: "Checked",
  latency: "Latency",
  latencyValue: "{value} ms",
  emptyTitle: "No component checks",
  emptyDescription:
    "The API returned overall health but no component-level checks.",
} as const;
