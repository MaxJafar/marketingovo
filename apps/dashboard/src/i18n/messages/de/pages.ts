import type { MessagesFor } from "../types";

/** URL inventory: the crawled pages table and its indexability evidence. */
export const pages: MessagesFor<"pages"> = {
  eyebrow: "URL-Inventar",
  title: "Seiten",
  description:
    "Verbinde technische Crawl-Evidenz mit organischem Traffic und Conversion-Kontext auf URL-Ebene.",
  columns: {
    page: "Seite",
    http: "HTTP",
    indexability: "Indexierbarkeit",
    clicks: "Klicks",
    internalLinks: "Interne Links",
    organicKeyEvents: "Organische Key Events",
    issues: "Probleme",
    coreWebVitals: "Core Web Vitals",
    lastCrawled: "Zuletzt gecrawlt",
  },
  linkCounts: "{inCount} rein · {outCount} raus",
  linkDepth: "Tiefe {depth} · eindeutige Seiten",
  explore: "Erkunden",
  exploreLinksFor: "Interne Links für {page} erkunden",
  searchLabel: "Seiten durchsuchen",
  searchPlaceholder: "Nach Titel oder URL suchen",
  tableLabel: "Gecrawlte Seiten",
  noMatchTitle: "Keine Seiten passen",
  noMatchBody: "Versuche eine breitere Titel- oder URL-Suche.",
  emptyTitle: "Keine gecrawlten Seiten",
  emptyBody:
    "Die API hat ein leeres Seiteninventar zurückgegeben. Starte ein Audit, um Evidenz auf URL-Ebene zu sammeln.",
  indexability: {
    reasons: {
      indexable: "Aus Crawl-Evidenz verifiziert",
      robotsBlocked: "Durch robots.txt blockiert",
      metaNoindex: "Meta-Robots noindex",
      xRobotsNoindex: "X-Robots-Tag noindex",
      canonicalized: "Canonical zeigt auf eine andere URL",
      nonHtml: "Nicht-HTML-Antwort",
      redirect: "Redirect-Antwort",
      httpError: "HTTP-Fehlerantwort",
      noContent: "Kein Antwortinhalt",
      fetchError: "Abruf fehlgeschlagen",
      missingStatus: "HTTP-Status nicht verfügbar",
      unexpectedStatus: "Unerwarteter HTTP-Status",
      missingContentType: "Content-Type nicht verfügbar",
      robotsUnknown: "Robots-Evidenz nicht verfügbar",
      parseFailed: "HTML-Evidenz nicht verfügbar",
    },
    evidenceUnavailable: "Evidenz nicht verfügbar",
    legacyResult: "Altes Audit-Ergebnis",
  },
} as const;
