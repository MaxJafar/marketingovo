import type { MessagesFor } from "../types";

/** Content intel: measured gaps against competitors, and topic clusters. */
export const contentIntel: MessagesFor<"contentIntel"> = {
  gaps: {
    title: "Contentgaten",
    loading: "Vergelijking lezen…",
    empty:
      "Nog geen contentgaten vastgelegd. Voeg concurrenten toe en draai een vergelijking om dit te vullen.",
    emptyLink: "concurrenten openen",
    coveredSingular: "gedekt door {count} referentie",
    coveredPlural: "gedekt door {count} referenties",
    density: "dichtheid {value}",
    tag: "Gat",
  },
  clusters: {
    title: "Topicclusters",
    loading: "Zoekwoordwerkruimte lezen…",
    empty: "Nog geen clusters. Draai een contentplan vanuit het zoekwoordlab.",
    emptyLink: "zoekwoordlab openen",
    cluster: "Cluster",
    keywords: "Zoekwoorden",
    coverage: "Dekking",
  },
} as const;
