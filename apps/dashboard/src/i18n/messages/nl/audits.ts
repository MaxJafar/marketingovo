import type { MessagesFor } from "../types";

/** The audits page: run launcher, private-site approval, crawl history. */
export const audits: MessagesFor<"audits"> = {
  eyebrow: "Crawlhistorie",
  title: "Audits",
  description:
    "Start een basismeting, volg actieve crawls en vergelijk voltooide technische snapshots.",
  starting: "Starten…",
  runFullAudit: "Volledige audit draaien",
  privateAccess: {
    summary: "Toegang tot privésites",
    allowTitle:
      "Sta precies deze hostnaam toe om voor deze audit een privénetwerk te benaderen",
    allowHelp:
      "Alleen {host}. Deze goedkeuring geldt voor audits die vanaf deze pagina starten totdat je van project wisselt; cloudmetadata blijft altijd geblokkeerd.",
  },
  scope: {
    summary: "Expert-auditbereik",
    title: "Audit een exact URL-cohort",
    body: "Plak één absolute URL per regel. Marketingovo crawlt alleen deze lijst en houdt elke URL als startpunt — handig voor migraties, templates, QA-steekproeven en verificatieruns.",
    urlListLabel: "URL-lijst",
    urlListHelp:
      "URL's moeten de projectorigin gebruiken. Fragmenten en duplicaten worden verwijderd voordat de run start.",
    errorTitle: "URL-cohort heeft aandacht nodig",
    submit: "URL-lijstaudit draaien",
    atLeastOneUrl: "Voeg minstens één absolute URL toe.",
    invalidUrl: "Ongeldige URL: {url}",
    unsupportedScheme: "Niet-ondersteund URL-schema: {scheme}",
  },
  startErrorTitle: "Audit kon niet starten",
  queuedTitle: "Audit in wachtrij",
  queuedBody:
    "De API heeft de run geaccepteerd. Ververs of volg de status hieronder.",
  columns: {
    started: "Gestart",
    status: "Status",
    trigger: "Trigger",
    pagesCrawled: "Gecrawlde pagina's",
    issues: "Issues",
    healthScore: "Gezondheidsscore",
  },
  tableLabel: "Auditruns",
  emptyTitle: "Nog geen auditruns",
  emptyBody:
    "Start een volledige basisaudit om crawlhistorie en geprioriteerde acties op te bouwen.",
} as const;
