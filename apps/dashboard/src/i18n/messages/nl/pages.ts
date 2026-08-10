import type { MessagesFor } from "../types";

/** URL inventory: the crawled pages table and its indexability evidence. */
export const pages: MessagesFor<"pages"> = {
  eyebrow: "URL-inventaris",
  title: "Pagina's",
  description:
    "Verbind technisch crawlbewijs met organisch verkeer en conversiecontext op URL-niveau.",
  columns: {
    page: "Pagina",
    http: "HTTP",
    indexability: "Indexeerbaarheid",
    clicks: "Klikken",
    internalLinks: "Interne links",
    organicKeyEvents: "Organische sleutelgebeurtenissen",
    issues: "Issues",
    coreWebVitals: "Core Web Vitals",
    lastCrawled: "Laatst gecrawld",
  },
  linkCounts: "{inCount} in · {outCount} uit",
  linkDepth: "Diepte {depth} · unieke pagina's",
  explore: "Verkennen",
  exploreLinksFor: "Interne links verkennen voor {page}",
  searchLabel: "Pagina's zoeken",
  searchPlaceholder: "Zoek op titel of URL",
  tableLabel: "Gecrawlde pagina's",
  noMatchTitle: "Geen pagina's passen",
  noMatchBody: "Probeer een bredere zoekopdracht op titel of URL.",
  emptyTitle: "Geen gecrawlde pagina's",
  emptyBody:
    "De API gaf een lege pagina-inventaris terug. Draai een audit om bewijs op URL-niveau te verzamelen.",
  indexability: {
    reasons: {
      indexable: "Geverifieerd uit crawlbewijs",
      robotsBlocked: "Geblokkeerd door robots.txt",
      metaNoindex: "Meta robots noindex",
      xRobotsNoindex: "X-Robots-Tag noindex",
      canonicalized: "Canonical wijst naar een andere URL",
      nonHtml: "Niet-HTML-antwoord",
      redirect: "Redirect-antwoord",
      httpError: "HTTP-foutantwoord",
      noContent: "Geen antwoordinhoud",
      fetchError: "Ophalen mislukt",
      missingStatus: "HTTP-status niet beschikbaar",
      unexpectedStatus: "Onverwachte HTTP-status",
      missingContentType: "Contenttype niet beschikbaar",
      robotsUnknown: "Robots-bewijs niet beschikbaar",
      parseFailed: "HTML-bewijs niet beschikbaar",
    },
    evidenceUnavailable: "Bewijs niet beschikbaar",
    legacyResult: "Verouderd auditresultaat",
  },
} as const;
