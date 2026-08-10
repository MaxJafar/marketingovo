import type { MessagesFor } from "../types";

/**
 * The Actions workbench: queue filters, the prioritized table, and the
 * marketer workflow controls.
 */
export const actions: MessagesFor<"actions"> = {
  eyebrow: "Werkbank van bewijs naar resultaat",
  title: "Acties",
  description:
    "Prioriteer, onderzoek, wijs toe en verifieer SEO-werk zonder technisch bewijs los te koppelen van zakelijke blootstelling.",
  statusNotSavedTitle: "Actiestatus is niet opgeslagen",
  filterTitle: "Vind het werk dat er nu toe doet",
  filterDescription:
    "Zoek op aanbeveling, regel, module of eigenaar. Ontbrekend bewijs blijft niet-beschikbaar en wordt nooit nul.",
  resetFilters: "Filters herstellen",
  searchLabel: "Acties zoeken",
  searchPlaceholder: "Canonical, kapotte links, eigenaar…",
  statusFilterLabel: "Status",
  allStatuses: "Alle statussen",
  verificationFilterLabel: "Verificatie",
  allVerification: "Alle verificaties",
  effortFilterLabel: "Inspanning",
  allEffort: "Alle inspanningen",
  effortOption: {
    low: "Laag",
    medium: "Gemiddeld",
    high: "Hoog",
  },
  sortByLabel: "Sorteren op",
  sortOption: {
    priority: "Prioriteitsscore",
    updated: "Meest recent bijgewerkt",
    affected: "Betrokken URL's",
    confidence: "Betrouwbaarheid",
  },
  priorityLegend: "Prioriteit",
  priorityGroupLabel: "Acties filteren op prioriteit",
  priorityFilter: {
    all: "Alle",
    critical: "Kritiek",
    high: "Hoog",
    medium: "Gemiddeld",
    low: "Laag",
  },
  showingCount: "{visible} van {total} acties getoond",
  tableLabel: "Geprioriteerde SEO-acties",
  columnPriority: "Prioriteit",
  columnAction: "Actie en bewijsgroep",
  columnScope: "Reikwijdte",
  columnEffort: "Inspanning",
  columnConfidence: "Betrouwbaarheid",
  columnWorkflow: "Workflow",
  columnVerification: "Verificatie",
  columnUpdated: "Bijgewerkt",
  statusLabel: {
    open: "open",
    acknowledged: "bevestigd",
    in_progress: "in behandeling",
    resolved: "opgelost",
  },
  verificationLabel: {
    pending: "wacht",
    verified: "geverifieerd",
    regressed: "teruggevallen",
  },
  moduleUnavailable: "Module niet beschikbaar",
  ruleUnavailable: "Regel niet beschikbaar",
  affectedUrls: "betrokken URL's",
  organicVisitsExposed: "{count} organische bezoeken blootgesteld",
  businessExposureUnavailable: "Zakelijke blootstelling niet beschikbaar",
  workflowStatusFor: "Workflowstatus voor {title}",
  saving: "Opslaan…",
  emptyFilteredTitle: "Geen acties passen bij deze filters",
  emptyFilteredDescription:
    "Herstel een of meer filters om terug te keren naar de volledige, op bewijs gestoelde wachtrij.",
  emptyQueueTitle: "Nog geen geprioriteerde acties",
  emptyQueueDescription:
    "Draai een audit om de eerste actiewachtrij op te bouwen. Een geldig leeg resultaat wordt nooit gepresenteerd als een perfecte score.",
} as const;
