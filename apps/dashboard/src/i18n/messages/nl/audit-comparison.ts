import type { MessagesFor } from "../types";

/** The audit comparison card: run pair selection and the evidence delta. */
export const auditComparison: MessagesFor<"auditComparison"> = {
  eyebrow: "Snapshot-intelligentie",
  title: "Auditruns vergelijken",
  description:
    "Onderscheid regressies van geverifieerde fixes met onveranderlijk issue- en paginabewijs. Er wordt geen nieuwe crawl gestart.",
  state: {
    comparable: "Vergelijkbaar",
    partial: "Gedeeltelijk bewijs",
    unavailable: "Paginabewijs niet beschikbaar",
  },
  emptyTitle: "Twee voltooide audits zijn vereist",
  emptyBody:
    "Draai een basismeting en één vervolgaudit. Runs voor zoekwoord-, content- en concurrentonderzoek vallen buiten de technische historie.",
  baselineAudit: "Basisaudit",
  currentAudit: "Huidige audit",
  openBaselineEvidence: "Basisbewijs openen",
  openCurrentEvidence: "Huidig bewijs openen",
  loading: "Bewijsdelta berekenen…",
  errorTitle: "Vergelijking niet beschikbaar",
  regressionPressure: "Regressiedruk",
  scoreExplainer:
    "Nieuwe issues tellen ernstgewicht op (kritiek 8, hoog 5, gemiddeld 3, laag 1); fixes trekken het af. HTTP-regressies tellen 3 op en indexeerbaarheidsregressies 2. Negatief is netto verbetering.",
  summary: {
    newWorse: "Nieuwe / verslechterde issues",
    resolvedReduced: "Opgelost / verminderd",
    healthChange: "Verandering SEO-gezondheid",
    pageRegressions: "Paginaregressies",
    pagesCaptured: "Vastgelegde pagina's",
    reviewedExcluded: "Beoordeelde ruis uitgesloten",
  },
  configuration: "Configuratie",
  configMatched:
    "De opgeslagen crawlinstellingen komen overeen in beide snapshots.",
  configDifferent: "Verschillende invoer: {differences}.",
  configUnavailable:
    "Opgeslagen instellingen zijn niet beschikbaar, dus gelijkwaardigheid van reikwijdte valt niet te bewijzen.",
  configFingerprints: "Config-vingerafdrukken: {baseline}… → {current}…",
  warningsTitle: "Interpretatienotities",
  columns: {
    finding: "Bevinding",
    change: "Verandering",
    url: "URL",
    before: "Voor",
    after: "Na",
    source: "Bron",
    target: "Doel",
    beforeAfter: "Voor → na",
  },
  regressions: {
    title: "Issue-regressies",
    description:
      "Nieuwe bevindingen en bevindingen waarvan de ernst is toegenomen.",
    caption: "Nieuwe en verslechterde SEO-issues",
    empty:
      "Er zijn geen nieuwe of verslechterde effectieve issues gedetecteerd.",
  },
  fixes: {
    title: "Geverifieerde fixes",
    description:
      "Bevindingen die in de huidige snapshot ontbreken of zijn afgenomen.",
    caption: "Opgeloste en verminderde SEO-issues",
    empty: "In dit paar is geen issue-oplossing geverifieerd.",
  },
  pages: {
    title: "Paginaveranderingen",
    description: "Status, indexeerbaarheid, toevoegingen en verwijderingen.",
    caption: "Veranderingen op paginaniveau tussen auditsnapshots",
    empty: "Voor dit paar zijn geen veranderingen op paginaniveau vastgelegd.",
  },
  links: {
    title: "Veranderingen in interne links",
    description:
      "Exacte bron-naar-doelrelaties uit onveranderlijke crawlgrafen. Ontstane en herstelde kapotte links worden geclassificeerd; redactionele structuur blijft neutraal.",
    graphCoverage: "Graafdekking",
    edgesCaptured: "Vastgelegde relaties",
    addedRemoved: "Toegevoegd / verwijderd",
    modified: "Gewijzigd",
    regressionsRecoveries: "Regressies / herstel",
    warningsTitle: "Notities bij de linkvergelijking",
    caption: "Veranderingen in interne links tussen auditsnapshots",
    emptyUnavailable:
      "Herhaal beide audits om vergelijkbaar bewijs over interne links vast te leggen.",
    empty:
      "Voor dit paar zijn geen veranderingen in interne linkrelaties vastgelegd.",
  },
  siteWide: "Site-breed",
  notInSnapshot: "Niet in snapshot",
  indexabilityUnknown: "indexeerbaarheid onbekend",
  indexable: "indexeerbaar",
  notIndexable: "niet indexeerbaar",
  statusUnavailable: "status niet beschikbaar",
  notPresent: "Niet aanwezig",
  occurrenceOne: "{count} voorkomen",
  occurrenceOther: "{count} voorkomens",
  truncationNotice:
    "Het API-antwoord bereikte een veiligheidslimiet. Exporteer de rundata of gebruik de SDK voor het volledige opgeslagen corpus.",
} as const;
