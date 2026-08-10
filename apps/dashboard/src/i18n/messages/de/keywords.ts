import type { MessagesFor } from "../types";

/** Keyword lab: research workflows, provider usage, clusters, opportunities. */
export const keywords: MessagesFor<"keywords"> = {
  eyebrow: "Nachfrage-Intelligenz",
  title: "Keywords & Content",
  description:
    "Finde Suchanfragen-Chancen, gruppiere Intent und verwandle Suchnachfrage in einen fokussierten Content-Plan.",
  starting: "Wird gestartet…",
  research: {
    title: "Einen Markt recherchieren",
    description:
      "Erweitere ein Seed-Keyword über Vorschläge, Intent, Trends, PAA und verwandte Suchanfragen.",
    seedLabel: "Seed-Keyword",
    start: "Keyword-Recherche starten",
  },
  plan: {
    title: "Einen Content-Plan bauen",
    description:
      "Gib bis zu zehn Seed-Themen ein, getrennt durch Kommas oder Zeilenumbrüche.",
    seedsLabel: "Seed-Themen",
    generate: "Content-Plan erzeugen",
  },
  notStartedTitle: "Recherche konnte nicht starten",
  queuedTitle: "Recherche eingereiht",
  queuedBody:
    "Der dauerhafte Lauf ist unter Audits sichtbar. Diese Seite zeigt das zuletzt abgeschlossene Rechercheergebnis.",
  usage: {
    title: "Anbieter-Nutzung der letzten Recherche",
    reported:
      "${cost} wurden von getakteten Anbietern über {billable} abrechenbare Anfrage(n) gemeldet.",
    unreported:
      "{count} abrechenbare Anfrage(n) haben keine Kosten pro Aufruf gemeldet und werden nicht als null angezeigt.",
    allReported:
      "Alle abrechenbaren Aufrufe in diesem Ergebnis haben ihre Kosten gemeldet.",
    free: "{count} abgeschlossene Anfrage(n) nutzten bekannt kostenlose Quellen.",
  },
  clusters: {
    title: "Content-Cluster",
    description:
      "Abdeckung und Briefing-Hinweise aus der verbundenen Keyword-Quelle.",
    keywordCount: "{count} Keywords",
    coverage: "Content-Abdeckung",
    coverageUnavailable: "Abdeckungsmessung nicht verfügbar",
    noBrief: "Keine Briefing-Empfehlung verfügbar.",
    emptyTitle: "Keine Content-Cluster",
    emptyBody:
      "Verbinde einen Keyword-Anbieter oder importiere Keyword-Daten, um Themen-Cluster zu bauen.",
  },
  opportunities: {
    title: "Keyword-Chancen",
    description:
      "Priorisiere Nachfrage anhand von Position, Suchvolumen, Schwierigkeit und Opportunity-Score.",
    tableLabel: "Keyword-Chancen",
    emptyTitle: "Keine Keyword-Chancen",
    emptyBody: "Die API hat ein gültiges leeres Chancen-Set zurückgegeben.",
    columns: {
      keyword: "Keyword",
      intent: "Intent",
      position: "Position",
      volume: "Volumen",
      difficulty: "Schwierigkeit",
      opportunity: "Chance",
      target: "Zielseite",
    },
    noCluster: "Kein Cluster",
    openPage: "Seite öffnen",
    invalidUrl: "Ungültige URL",
    unassigned: "Nicht zugewiesen",
  },
} as const;
