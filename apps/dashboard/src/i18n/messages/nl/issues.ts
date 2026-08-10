import type { MessagesFor } from "../types";

/** Issue review: filters, the evidence table, and the adjudication editor. */
export const issues: MessagesFor<"issues"> = {
  eyebrow: "Kwaliteitscontrole",
  title: "Issue-review",
  description:
    "Inspecteer crawlbewijs, documenteer bewuste uitzonderingen en houd valse positieven uit toekomstige prioriteiten zonder de audithistorie te wissen.",
  filters: {
    title: "Scheid signaal van geaccepteerd gedrag",
    description:
      "Zoek op titels, regels, modules, vingerafdrukken en canonieke URL's. Beslissingen gelden alleen voor de geselecteerde site.",
    reset: "Filters herstellen",
    searchLabel: "Issues zoeken",
    searchPlaceholder: "Regel, URL, titel, vingerafdruk…",
    status: "Status",
    allStatuses: "Alle statussen",
    statusOpen: "Open",
    statusResolved: "Opgelost door audit",
    statusIgnored: "Bewust genegeerd",
    statusFalsePositive: "Valse positieven",
    severity: "Ernst",
    allSeverities: "Alle ernstniveaus",
    severityCritical: "Kritiek",
    severityHigh: "Hoog",
    severityMedium: "Gemiddeld",
    severityLow: "Laag",
    severityInfo: "Info",
  },
  showingRange: "{start}–{end} van {total} issues getoond",
  tableLabel: "SEO-issues die een reviewbeslissing afwachten of dragen",
  columns: {
    severity: "Ernst",
    issue: "Issue",
    url: "URL",
    status: "Status",
    occurrences: "Voorkomens",
    lastSeen: "Laatst gezien",
    review: "Review",
  },
  siteWide: "Site-breed",
  /** Keyed by the API's `IssueStatus` enum; fall back to the raw value. */
  statusLabel: {
    open: "open",
    resolved: "opgelost",
    ignored: "genegeerd",
    false_positive: "vals positief",
  },
  hide: "Verbergen",
  review: "Reviewen",
  paginationLabel: "Issuepagina's",
  previous: "Vorige",
  next: "Volgende",
  pageOf: "Pagina {page} van {total}",
  emptyFilteredTitle: "Geen issues passen",
  emptyFilteredBody:
    "Verbreed de filters of zoek op een andere regel, module, titel of URL.",
  emptyOpenTitle: "Geen open issues",
  emptyOpenBody:
    "Draai een audit om issuebewijs te verzamelen, of zet het statusfilter om opgeloste bevindingen te reviewen.",
  editor: {
    eyebrow: "Bewijsreview",
    close: "Review sluiten",
    rule: "Regel",
    module: "Module",
    firstSeen: "Eerst gezien",
    occurrences: "Voorkomens",
    evidenceTitle: "Vastgelegd bewijs",
    structuredEvidence: "Gestructureerd bewijs",
    noEvidence:
      "Deze bevinding heeft geen gestructureerde bewijspayload. Bekijk de regel, URL en audithistorie voordat je classificeert.",
    decision: "Reviewbeslissing",
    keepTitle: "Actiegericht houden",
    keepBody:
      "Verwijder elke handmatige override en beoordeel toekomstige runs normaal.",
    ignoreTitle: "Bewust negeren",
    ignoreBody: "Het gedrag is echt, begrepen en geaccepteerd voor deze site.",
    falsePositiveTitle: "Als vals positief markeren",
    falsePositiveBody:
      "De regel beschrijft deze pagina of implementatie niet correct.",
    reasonLabel: "Reden van de review",
    reasonRequired: "(verplicht)",
    reasonOptional: "(optioneel)",
    reasonPlaceholder:
      "Licht de sitecontext toe zodat een andere marketeer deze beslissing later kan verifiëren.",
    charCount: "{count} / 2.000 tekens",
    confirmation:
      "Ik heb het bewijs beoordeeld. Houd deze classificatie aan bij toekomstige audits totdat iemand haar heropent.",
    saved: "Review opgeslagen. Acties en overzichtsprioriteiten zijn ververst.",
    saving: "Opslaan…",
    save: "Review opslaan",
    retention: "Ruw auditbewijs en historie worden nooit verwijderd.",
  },
} as const;
