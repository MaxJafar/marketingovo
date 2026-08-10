import type { MessagesFor } from "../types";

/** The decision-center overview: health hero, metric grid, source health. */
export const overview: MessagesFor<"overview"> = {
  eyebrow: "Entscheidungszentrale",
  siteTitle: "Überblick für {name}",
  fallbackTitle: "Dein Marketing-Überblick",
  description:
    "Sieh, was sich geändert hat, was zählt und welcher Zug die Ergebnisse am wahrscheinlichsten verbessert.",
  startingAudit: "Audit wird gestartet…",
  runFullAudit: "Voll-Audit starten",
  auditNotStartedTitle: "Audit konnte nicht starten",
  auditQueuedTitle: "Audit eingereiht",
  auditQueuedBody:
    "Das Audit wurde angenommen. Verfolge den Fortschritt im Audits-Bereich.",
  health: {
    eyebrow: "Site-Zustand",
    title: "Eine klare Baseline für deine nächste Entscheidung",
    body: "Der Health-Score kombiniert die Signale deiner konfigurierten Audit-Quellen. Fehlende Eingaben bleiben sichtbar.",
    reviewActions: "Priorisierte Maßnahmen prüfen",
    currentScore: "Aktueller Score",
    pointsVsPriorAudit: "{change} Health-Punkte ggü. vorherigem Audit",
    comparisonUnavailable: "Vergleich nicht verfügbar",
  },
  regressions: {
    eyebrow: "Jetzt beobachten",
    title: "Kritische Regressionen",
    body: "Probleme, die eine sofortige Triage brauchen könnten.",
    openQueue: "Maßnahmen-Warteschlange öffnen",
  },
  performance: {
    title: "Performance auf einen Blick",
    description:
      "Marketing-Ergebnisse und technische Abdeckung, ohne fehlende Daten in null zu verwandeln.",
    organicClicks: "Organische Klicks",
    organicClicksHelp: "Verbinde die Search Console für Vergleiche",
    organicKeyEvents: "Organische Key Events",
    organicKeyEventsHelp: "Verbinde GA4, um organische Ergebnisse zu messen",
    indexableCoverage: "Indexierbare Abdeckung",
    coreWebVitalsPassRate: "Core-Web-Vitals-Bestehensquote",
  },
  topActions: {
    title: "Top-5-Maßnahmen",
    description:
      "Gerankt nach geschätztem Impact, Aufwand, Konfidenz und der von der API gelieferten Evidenz.",
    viewAll: "Alle Maßnahmen ansehen",
    emptyTitle: "Noch keine priorisierten Maßnahmen",
    emptyDescription:
      "Starte nach dem Verbinden deiner Datenquellen ein Baseline-Audit. Ein gültiges leeres Ergebnis wird leer angezeigt — nicht als perfekter Score.",
  },
  trendTitle: "Health-Score-Trend",
  sources: {
    title: "Zustand der Datenquellen",
    description: "Wisse, welche Eingaben diese Ansicht stützen.",
    manage: "Verwalten",
    updated: "Aktualisiert {date}",
    coverage: "{value} % Abdeckung",
    unavailableTitle: "Quellenstatus nicht verfügbar",
    unavailableBody:
      "Die API hat die Quellen hinter diesem Überblick nicht benannt.",
  },
} as const;
