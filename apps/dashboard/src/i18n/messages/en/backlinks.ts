/** Backlinks: the internal graph the crawler proves, and the stated boundary. */
export const backlinks = {
  internalTitle: "Internal link graph",
  lookingForAudit: "Looking for a completed audit…",
  latestAuditBody:
    "The most recent audit mapped every internal link on the site. Open its explorer to trace inlinks and outlinks for any page.",
  openExplorer: "Open link explorer →",
  noAuditYet:
    "No completed audit yet. Run one and the internal link graph appears here.",
  openAudits: "open audits",
  externalTitle: "External backlinks",
  externalBody:
    "Marketingovo crawls your site, not the rest of the web, so it cannot measure referring domains on its own. There is no backlink number to show here and none is estimated.",
  agentBodyBefore:
    "An attached agent can research this with its own tools. Ask it in the terminal below — for example",
  agentExample: "which sites linked to our pricing page this quarter",
  agentBodyAfter: ".",
} as const;
