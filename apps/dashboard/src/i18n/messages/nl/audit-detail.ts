import type { MessagesFor } from "../types";

/** The audit run page: replay, sitemap coverage, and the evidence workbench. */
export const auditDetail: MessagesFor<"auditDetail"> = {
  backToAudits: "Terug naar audits",
  eyebrow: "Auditrun",
  runTitle: "Run {id}",
  fallbackTitle: "Auditdetails",
  description:
    "Inspecteer brondekking en exact bewijs, of speel de opgeslagen runconfiguratie opnieuw af tegen de huidige staat van de site.",
  queuingReplay: "Replay in wachtrij zetten…",
  replayConfiguration: "Replay-configuratie",
  replayErrorTitle: "Replay kon niet starten",
  replayQueuedTitle: "Onafhankelijke replay in wachtrij",
  replayQueuedBefore:
    "Opgeslagen configuratie v{version} is gekopieerd zonder deze run te wijzigen. De replay leest de huidige staat van de site en providers.",
  replayQueuedLink: "Replay openen",
  replayQueuedAfter: ".",
  boundaryTitle: "Replay-grens",
  boundaryBody:
    "Replay maakt een nieuwe run van deze opgeslagen workflow en zijn exacte opties. Dit resultaat wordt nooit bewerkt; live pagina's en integraties worden opnieuw bevraagd zodat veranderingen meetbaar blijven.",
  summary: {
    status: "Status",
    started: "Gestart",
    completed: "Voltooid",
    issueInstances: "Issue-instanties",
  },
  breakdownTitle: "Issue-verdeling",
  breakdownEmptyTitle: "Verdeling niet beschikbaar",
  breakdownEmptyBody: "De run gaf geen totalen per ernst terug.",
  runLogTitle: "Runlog",
  runLogEmptyTitle: "Geen logregels",
  runLogEmptyBody: "De API gaf geen runlog terug.",
  sitemap: {
    eyebrow: "Vastgelegde bron",
    title: "Sitemapdekking",
    description:
      "Dekking vergelijkt vastgelegde indexeerbare crawl-URL's met de sitemapsnapshot die precies deze run gebruikte.",
    declaredUrls: "Gedeclareerde URL's",
    indexableDiscovered: "Indexeerbaar ontdekt",
    matched: "Gematcht",
    coverage: "Dekking",
    snapshotBefore: "Snapshot:",
    httpStatusSuffix: " · HTTP {status}",
    filesLabel: "Vastgelegde sitemapbestanden",
    fileColumn: "Sitemapbestand",
    typeColumn: "Type",
    httpColumn: "HTTP",
    locationsColumn: "Locaties",
    missingIndexable: "Indexeerbaar maar afwezig",
    declaredNotCrawled: "Gedeclareerd maar niet gecrawld",
    brokenDeclared: "Gedeclareerde HTTP-fouten",
    sampleUnavailable:
      "Niet beschikbaar omdat er geen geverifieerde sitemapsnapshot is vastgelegd.",
    sampleTruncated:
      "De eerste {shown} van {total} URL's worden getoond. Het JSON-rapport bewaart het volledige vastgelegde cohort.",
  },
  tabs: {
    crawl: {
      label: "Crawlpaden",
      description: "Kortste vastgelegde ontdekkingspad en eerste verwijzer.",
    },
    redirects: {
      label: "Redirects",
      description:
        "Opgevraagde URL, elke redirect-stap en het uiteindelijke antwoord.",
    },
    hreflang: {
      label: "Hreflang",
      description: "Taaldoelen, zelfverwijzingen en wederkerig bewijs.",
    },
    extractions: {
      label: "Extracties",
      description:
        "Aangepaste velden vastgelegd door de geconfigureerde extractieregels.",
    },
  },
  crawl: {
    tableLabel: "Bewijs van crawlpaden",
    pageColumn: "Pagina",
    depthColumn: "Diepte",
    referrerColumn: "Eerste verwijzer",
    httpColumn: "HTTP",
    indexableColumn: "Indexeerbaar",
    seed: "Startpunt",
  },
  redirects: {
    tableLabel: "Bewijs van redirectpaden",
    requestedColumn: "Opgevraagde URL",
    pathColumn: "Vastgelegd pad",
    hopsColumn: "Stappen",
    finalHttpColumn: "Uiteindelijke HTTP",
  },
  hreflang: {
    tableLabel: "Hreflang-bewijsmatrix",
    sourceColumn: "Bronpagina",
    languageColumn: "HTML- / eigen taal",
    alternateColumn: "Alternatief",
    targetColumn: "Doel",
    reciprocalColumn: "Wederkerig",
    missing: "Ontbreekt",
    selfReference: "Zelfverwijzing",
    mismatch: "Verwacht {expected}; waargenomen {observed}",
    sourceFallback: "bron",
    noneFallback: "geen",
  },
  extractions: {
    tableLabel: "Bewijs van aangepaste extracties",
    pageColumn: "Pagina",
    fieldsColumn: "Vastgelegde velden",
    noMatch: "Geen match",
    truncatedSuffix: " (afgekapt)",
  },
  workbench: {
    eyebrow: "Geversioneerd auditbewijs",
    title: "Bewijswerkbank",
    description:
      "De UI pagineert opgeslagen bewijs; een cohort wordt nooit afgekapt zonder het totaal te tonen.",
    tablistLabel: "Bewijssecties",
    searchLabel: "Bewijs zoeken op pagina-URL of titel",
    searchPlaceholder: "Zoek op pagina-URL of titel",
    search: "Zoeken",
    clear: "Wissen",
    paginationLabel: "Bewijspagina's",
    previous: "Vorige",
    next: "Volgende",
    pageIndicator: "Pagina {page} van {pages} · {records} records",
  },
  emptyTitle: "Geen {section} vastgelegd",
  emptyUnavailable:
    "Deze run bevat geen geversioneerd paginabewijs. Draai een nieuwe audit om de werkbank te vullen.",
  emptyFiltered:
    "De geselecteerde run heeft geen passende {section}. Dit is een gemeten lege toestand, geen mislukte query.",
  fallbackEvidence: "bewijs",
  fallbackRecords: "records",
} as const;
