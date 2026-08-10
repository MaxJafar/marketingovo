import type { MessagesFor } from "../types";

/** The console home: hero banner, KPI stats, and the overview panels. */
export const dashboard: MessagesFor<"dashboard"> = {
  hero: {
    welcome: "willkommen bei",
    tagline: "dein All-in-one-Terminal für Marketing-Intelligenz",
    bubble: "daten schlafen nie",
  },
  stats: {
    seoVisibility: "SEO-Sichtbarkeit",
    organicTraffic: "Organischer Traffic",
    keyEvents: "Key Events",
    cwvPassRate: "CWV-Bestehensquote",
    noTrendYet: "noch kein trend",
    /** Rendered through `toDelta` in lib/intel.ts. */
    noChange: "keine veränderung",
    runAuditToMeasure: "starte ein audit zum messen",
    connectSearchConsole: "Search Console verbinden",
    connectAnalytics: "Analytics verbinden",
    runAuditWithVitals: "starte ein audit mit vitals",
  },
  seoOverview: {
    title: "SEO-Überblick",
    domainHealth: "Domain-Zustand",
    empty:
      "Noch kein Audit hat diese Site gemessen, also gibt es keinen Health-Score zu zeichnen — eine Platzhalterzahl wäre eine Erfindung.",
    runAudit: "Audit starten →",
    donutLabel: "Domain-Zustand {value} von 100",
    crawlability: "Crawlbarkeit",
    sitePerformance: "Site-Performance",
    onPageSeo: "On-Page-SEO",
    keyEvents: "Key Events",
  },
  crossChannel: {
    title: "Kanalübergreifender Bericht",
    body: "Das kundenfertige Dokument über Paid, Organic, Social, E-Mail, Wettbewerber und erledigte Arbeit — Diagramme nur aus gemessenen Werten, als PDF exportiert und auf täglichem, wöchentlichem oder monatlichem Zeitplan erzeugt.",
    openReport: "Bericht öffnen →",
    scheduleIt: "Einplanen →",
  },
  topKeywords: {
    title: "Top-Keywords",
    empty: "Für diesen Workspace ist noch keine Keyword-Recherche gelaufen.",
    openLab: "Keyword-Lab öffnen →",
    keyword: "Keyword",
    position: "Pos.",
    volume: "Vol.",
    viewAll: "Alle Keywords ansehen →",
  },
  competitorInsights: {
    title: "Wettbewerber-Insights",
    empty:
      "Noch kein Wettbewerbervergleich ist gelaufen, also gibt es nichts Gemessenes zu ranken.",
    research: "Wettbewerber recherchieren →",
    domain: "Domain",
    visibility: "Sichtbarkeit",
    you: "du ({name})",
    thisSite: "diese Site",
    viewAll: "Wettbewerber ansehen →",
  },
  contentFeed: {
    title: "Content-Intel-Feed",
    empty:
      "Content-Lücken erscheinen hier, nachdem ein Wettbewerbervergleich sie gemessen hat.",
    open: "Content-Intel öffnen →",
    competitorsCovering: "◉ {count} Wettbewerber decken es ab",
    gapTag: "Content-Lücke",
    viewFeed: "Content-Feed ansehen →",
  },
} as const;
