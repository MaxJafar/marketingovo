/** Social research: honest source status and where measured data lives. */
export const socialResearch = {
  status: {
    title: "Source status",
    connectedSingular:
      "{count} social source connected for publishing. Listening — mentions, sentiment, engagement — has no collector yet, so nothing of that kind is measured or shown.",
    connectedPlural:
      "{count} social sources connected for publishing. Listening — mentions, sentiment, engagement — has no collector yet, so nothing of that kind is measured or shown.",
    none: "No social source is connected, and social listening has no collector yet — so this page shows no mention or sentiment figures at all rather than inventing them.",
    connectLink: "connect a source",
  },
  measured: {
    title: "What is measured today",
    body: "Publishing is measured end to end: every post staged in the calendar keeps an immutable record of the exact request sent to each platform, and the cross-channel report counts published, refused, and indeterminate sends per platform.",
    openCalendar: "Open the calendar →",
    openReport: "See it in the report →",
  },
  agent: {
    title: "Ask the agent",
    bodyBefore:
      "Social listening is not yet a Marketingovo collector. An attached agent can still research this for you from its own tools — try asking it in the terminal below, for example",
    examplePrompt: "summarise what people said about us on Reddit this month",
    bodyAfter: ".",
  },
} as const;
