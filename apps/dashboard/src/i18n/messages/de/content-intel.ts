import type { MessagesFor } from "../types";

/** Content intel: measured gaps against competitors, and topic clusters. */
export const contentIntel: MessagesFor<"contentIntel"> = {
  gaps: {
    title: "Content-Lücken",
    loading: "Vergleich wird gelesen…",
    empty:
      "Noch keine Content-Lücken erfasst. Füge Wettbewerber hinzu und starte einen Vergleich, um das hier zu befüllen.",
    emptyLink: "Wettbewerber öffnen",
    coveredSingular: "abgedeckt von {count} Referenz",
    coveredPlural: "abgedeckt von {count} Referenzen",
    density: "Dichte {value}",
    tag: "Lücke",
  },
  clusters: {
    title: "Themen-Cluster",
    loading: "Keyword-Workspace wird gelesen…",
    empty: "Noch keine Cluster. Starte einen Content-Plan aus dem Keyword-Lab.",
    emptyLink: "Keyword-Lab öffnen",
    cluster: "Cluster",
    keywords: "Keywords",
    coverage: "Abdeckung",
  },
} as const;
