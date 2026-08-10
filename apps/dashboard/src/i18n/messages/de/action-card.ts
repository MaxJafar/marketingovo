import type { MessagesFor } from "../types";

/**
 * The single-action card used on dashboard surfaces: decision factors, the
 * workflow control, and the evidence disclosure.
 */
export const actionCard: MessagesFor<"actionCard"> = {
  fallbackCategory: "Maßnahme",
  rankLabel: "#{rank}",
  priorityBadge: "Priorität {priority}",
  priorityLabel: {
    critical: "kritisch",
    high: "hoch",
    medium: "mittel",
    low: "niedrig",
  },
  impactLabel: {
    high: "hoch",
    medium: "mittel",
    low: "niedrig",
  },
  effortLabel: {
    low: "niedrig",
    medium: "mittel",
    high: "hoch",
    small: "klein",
    large: "groß",
  },
  statusLabel: {
    open: "offen",
    acknowledged: "bestätigt",
    in_progress: "in Arbeit",
    resolved: "gelöst",
  },
  factorsLabel: "Prioritätsfaktoren",
  impact: "Impact",
  effort: "Aufwand",
  confidence: "Konfidenz",
  priorityScore: "Prioritäts-Score",
  workflowStatus: "Workflow-Status",
  workflowStatusFor: "Workflow-Status für {title}",
  savingStatus: "Status wird gespeichert…",
  whyPrioritized: "Warum das priorisiert ist",
  noPriorityExplanation:
    "Die API hat keine Erklärung zur Priorisierung geliefert.",
  evidenceSummary: "Evidenz und Umfang",
  noEvidence: "Für diese Maßnahme wurde keine stützende Evidenz zurückgegeben.",
} as const;
