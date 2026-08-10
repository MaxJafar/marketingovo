/** Content intel: measured gaps against competitors, and topic clusters. */
export const contentIntel = {
  gaps: {
    title: "Content gaps",
    loading: "Reading the comparison…",
    empty:
      "No content gaps recorded yet. Add competitors and run a comparison to populate this.",
    emptyLink: "open competitors",
    coveredSingular: "covered by {count} reference",
    coveredPlural: "covered by {count} references",
    density: "density {value}",
    tag: "Gap",
  },
  clusters: {
    title: "Topic clusters",
    loading: "Reading the keyword workspace…",
    empty: "No clusters yet. Run a content plan from the keyword lab.",
    emptyLink: "open keyword lab",
    cluster: "Cluster",
    keywords: "Keywords",
    coverage: "Coverage",
  },
} as const;
