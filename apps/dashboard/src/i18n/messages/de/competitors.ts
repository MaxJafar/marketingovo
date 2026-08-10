import type { MessagesFor } from "../types";

/** Competitors: the comparison workflow and crawl-evidence cards. */
export const competitors: MessagesFor<"competitors"> = {
  eyebrow: "Marktkontext",
  title: "Wettbewerber",
  description:
    "Crawl-Evidenz, Publikationsrhythmus und Content-Lücken, alles von der eigenen Site jedes Rivalen erhoben — kein Provider-Key nötig. Lücken auf Keyword-Ebene bleiben ausdrücklich nicht verfügbar, bis ein unterstützender Anbieter sie liefert.",
  form: {
    title: "Einen reproduzierbaren Vergleich starten",
    description:
      "Gib eine oder zwei Wettbewerber-Domains ein. Jede Site wird mit denselben Limits gecrawlt; diese Ansicht berichtet technische Evidenz, keine erfundenen Sichtbarkeitsdaten.",
    domainsLabel: "Wettbewerber-Domains",
    starting: "Wird gestartet…",
    submit: "Sites vergleichen",
  },
  notStartedTitle: "Vergleich konnte nicht starten",
  queuedTitle: "Vergleich eingereiht",
  queuedBody:
    "Der dauerhafte Lauf ist unter Audits sichtbar. Diese Seite zeigt den zuletzt abgeschlossenen Vergleich.",
  card: {
    updated: "Aktualisiert {date}",
    publishesEvery: "Publiziert alle",
    cadenceDays: "{count} Tage",
    cadenceUnavailableHint:
      "Es wurde kein Feed gefunden, oder der Feed enthielt zu wenige datierte Beiträge, um ein Intervall zu messen.",
    lastPublished: "Zuletzt publiziert",
    daysAgo: "vor {count} Tagen",
    technicalHealth: "Technischer Zustand",
    change: "Veränderung",
    changeUnavailableHint:
      "Kein früherer Vergleich enthält diese Site, also gibt es keine Baseline, gegen die sich etwas bewegen könnte.",
    noChange: "Keine Veränderung",
    changePts: "{value} Pkt.",
    sharedKeywords: "Gemeinsame Keywords",
    keywordGaps: "Keyword-Lücken",
    coversGapTopics: "Deckt Lücken-Themen ab",
  },
  emptyTitle: "Keine Wettbewerber konfiguriert",
  emptyBody:
    "Füge Wettbewerber-Domains über die API oder den Setup-Flow hinzu, um Marktkontext freizuschalten.",
  gaps: {
    title: "Themen, die sie abdecken und du nicht",
    description:
      "Abgeleitet aus den Seiten selbst, daher ist kein Keyword-Anbieter nötig. Jeder Begriff kommt auf den Wettbewerberseiten in deutlich höherer Dichte vor als auf deiner Site.",
    coverageOne: "auf {covering} von {total} verglichener Site",
    coverageMany: "auf {covering} von {total} verglichenen Sites",
  },
} as const;
