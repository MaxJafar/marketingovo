import type { MessagesFor } from "../types";

/**
 * The Actions workbench: queue filters, the prioritized table, and the
 * marketer workflow controls.
 */
export const actions: MessagesFor<"actions"> = {
  eyebrow: "Workbench von Evidenz zu Ergebnis",
  title: "Maßnahmen",
  description:
    "Priorisiere, untersuche, verteile und verifiziere SEO-Arbeit, ohne technische Evidenz von der Business-Exposition zu trennen.",
  statusNotSavedTitle: "Maßnahmenstatus wurde nicht gespeichert",
  filterTitle: "Finde die Arbeit, die jetzt zählt",
  filterDescription:
    "Suche nach Empfehlung, Regel, Modul oder Verantwortlichem. Fehlende Evidenz bleibt nicht verfügbar und wird nie zu null.",
  resetFilters: "Filter zurücksetzen",
  searchLabel: "Maßnahmen durchsuchen",
  searchPlaceholder: "Canonical, defekte Links, Verantwortliche…",
  statusFilterLabel: "Status",
  allStatuses: "Alle Status",
  verificationFilterLabel: "Verifikation",
  allVerification: "Alle Verifikationen",
  effortFilterLabel: "Aufwand",
  allEffort: "Jeder Aufwand",
  effortOption: {
    low: "Niedrig",
    medium: "Mittel",
    high: "Hoch",
  },
  sortByLabel: "Sortieren nach",
  sortOption: {
    priority: "Prioritäts-Score",
    updated: "Zuletzt aktualisiert",
    affected: "Betroffene URLs",
    confidence: "Konfidenz",
  },
  priorityLegend: "Priorität",
  priorityGroupLabel: "Maßnahmen nach Priorität filtern",
  priorityFilter: {
    all: "Alle",
    critical: "Kritisch",
    high: "Hoch",
    medium: "Mittel",
    low: "Niedrig",
  },
  showingCount: "{visible} von {total} Maßnahmen angezeigt",
  tableLabel: "Priorisierte SEO-Maßnahmen",
  columnPriority: "Priorität",
  columnAction: "Maßnahme und Evidenzgruppe",
  columnScope: "Umfang",
  columnEffort: "Aufwand",
  columnConfidence: "Konfidenz",
  columnWorkflow: "Workflow",
  columnVerification: "Verifikation",
  columnUpdated: "Aktualisiert",
  statusLabel: {
    open: "offen",
    acknowledged: "bestätigt",
    in_progress: "in Arbeit",
    resolved: "gelöst",
  },
  verificationLabel: {
    pending: "ausstehend",
    verified: "verifiziert",
    regressed: "verschlechtert",
  },
  moduleUnavailable: "Modul nicht verfügbar",
  ruleUnavailable: "Regel nicht verfügbar",
  affectedUrls: "betroffene URLs",
  organicVisitsExposed: "{count} organische Besuche exponiert",
  businessExposureUnavailable: "Business-Exposition nicht verfügbar",
  workflowStatusFor: "Workflow-Status für {title}",
  saving: "Wird gespeichert…",
  emptyFilteredTitle: "Keine Maßnahme passt zu diesen Filtern",
  emptyFilteredDescription:
    "Setze einen oder mehrere Filter zurück, um zur vollständigen evidenzgestützten Warteschlange zurückzukehren.",
  emptyQueueTitle: "Noch keine priorisierten Maßnahmen",
  emptyQueueDescription:
    "Starte ein Audit, um die erste Maßnahmen-Warteschlange zu erzeugen. Ein gültiges leeres Ergebnis wird nie als perfekter Score dargestellt.",
} as const;
