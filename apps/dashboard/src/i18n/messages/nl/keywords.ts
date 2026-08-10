import type { MessagesFor } from "../types";

/** Keyword lab: research workflows, provider usage, clusters, opportunities. */
export const keywords: MessagesFor<"keywords"> = {
  eyebrow: "Vraagintelligentie",
  title: "Zoekwoorden & content",
  description:
    "Vind zoekkansen, groepeer intentie en zet zoekvraag om in een gericht contentplan.",
  starting: "Starten…",
  research: {
    title: "Onderzoek één markt",
    description:
      "Breid een seed uit over suggesties, intentie, Trends, PAA en gerelateerde zoekopdrachten.",
    seedLabel: "Seed-zoekwoord",
    start: "Zoekwoordonderzoek starten",
  },
  plan: {
    title: "Bouw een contentplan",
    description:
      "Voer tot tien seed-onderwerpen in, gescheiden door komma's of nieuwe regels.",
    seedsLabel: "Seed-onderwerpen",
    generate: "Contentplan genereren",
  },
  notStartedTitle: "Onderzoek kon niet starten",
  queuedTitle: "Onderzoek in wachtrij",
  queuedBody:
    "De duurzame run is zichtbaar onder Audits. Deze pagina toont het laatst voltooide onderzoeksresultaat.",
  usage: {
    title: "Providergebruik laatste onderzoek",
    reported:
      "${cost} is gerapporteerd door gemeten providers over {billable} factureerbare aanvraag/aanvragen.",
    unreported:
      "{count} factureerbare aanvraag/aanvragen rapporteerden geen kosten per call en worden niet als nul getoond.",
    allReported:
      "Alle factureerbare calls in dit resultaat rapporteerden hun kosten.",
    free: "{count} voltooide aanvraag/aanvragen gebruikten bekende gratis bronnen.",
  },
  clusters: {
    title: "Contentclusters",
    description: "Dekking en briefadvies vanuit de verbonden zoekwoordbron.",
    keywordCount: "{count} zoekwoorden",
    coverage: "Contentdekking",
    coverageUnavailable: "Dekkingsmeting niet beschikbaar",
    noBrief: "Geen briefadvies beschikbaar.",
    emptyTitle: "Geen contentclusters",
    emptyBody:
      "Verbind een zoekwoordprovider of importeer zoekwoorddata om topicclusters te bouwen.",
  },
  opportunities: {
    title: "Zoekwoordkansen",
    description:
      "Prioriteer vraag op basis van positie, zoekvolume, moeilijkheid en kansscore.",
    tableLabel: "Zoekwoordkansen",
    emptyTitle: "Geen zoekwoordkansen",
    emptyBody: "De API gaf een geldige lege kansenset terug.",
    columns: {
      keyword: "Zoekwoord",
      intent: "Intentie",
      position: "Positie",
      volume: "Volume",
      difficulty: "Moeilijkheid",
      opportunity: "Kans",
      target: "Doelpagina",
    },
    noCluster: "Geen cluster",
    openPage: "Pagina openen",
    invalidUrl: "Ongeldige URL",
    unassigned: "Niet toegewezen",
  },
} as const;
