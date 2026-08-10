import type { MessagesFor } from "../types";

/** Per-page internal link explorer: direction tabs, summary, evidence table. */
export const internalLinkExplorer: MessagesFor<"internalLinkExplorer"> = {
  regionLabel: "Interne links voor {title}",
  eyebrow: "Onveranderlijke crawlgraaf",
  closeExplorer: "Verkenner sluiten",
  unavailableTitle: "Linkbewijs niet beschikbaar",
  unavailableBody:
    "Herhaal deze audit om geversioneerd inlink- en outlinkbewijs vast te leggen. Bestaande pagina- en issuehistorie blijft onveranderd.",
  directionTabsLabel: "Linkrichting",
  inlinksTab: "Inlinks · {count} bronnen",
  outlinksTab: "Outlinks · {count} doelen",
  searchLabel: "In deze richting zoeken",
  searchPlaceholder: "URL, paginatitel of ankertekst",
  search: "Zoeken",
  loading: "Opgeslagen linkgraaf lezen…",
  graphUnavailableTitle: "Linkgraaf niet beschikbaar",
  summary: {
    inlinkSources: "Inlinkbronnen",
    outlinkTargets: "Outlinkdoelen",
    totalOccurrences: "{count} voorkomens in totaal",
    redirectedTargets: "Doorverwezen doelen",
    redirectedHelp:
      "Interne links die naar de uiteindelijke URL zouden moeten wijzen",
    brokenTargets: "Kapotte doelen",
    brokenHelp: "Bestemmingen die HTTP 4xx of 5xx teruggeven",
  },
  coverageLimitationTitle: "Dekkingsbeperking",
  table: {
    label: "{direction} voor {title}",
    captionInlinks: "Pagina's die naar de geselecteerde URL linken",
    captionOutlinks: "Interne bestemmingen waarnaar de geselecteerde URL linkt",
    sourcePageColumn: "Bronpagina",
    destinationColumn: "Bestemming",
    stateColumn: "Toestand",
    anchorColumn: "Ankerbewijs",
    followColumn: "Follow",
    finalUrl: "Uiteindelijke URL: {url}",
    httpStatus: "HTTP {status}",
    noTextCaptured: "Geen tekst vastgelegd",
    placementUnavailable: "Plaatsing niet beschikbaar",
    followSummary: "{follow} follow · {nofollow} nofollow",
  },
  empty: {
    noLinksMatch: "Geen links passen",
    noDirectionCaptured: "Geen {direction} vastgelegd",
    searchHint: "Probeer een bredere zoekopdracht op URL, titel of ankertekst.",
    inlinksHint:
      "Geen gecrawlde pagina linkt naar deze URL in de geselecteerde snapshot.",
    outlinksHint: "Deze pagina heeft geen vastgelegde interne bestemmingen.",
  },
  paginationLabel: "Pagina's met linkbewijs",
  previous: "Vorige",
  next: "Volgende",
  zeroResults: "0 resultaten",
  resultsRange: "{from}–{to} van {total}",
} as const;
