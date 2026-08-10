import type { MessagesFor } from "../types";

/**
 * The single-action card used on dashboard surfaces: decision factors, the
 * workflow control, and the evidence disclosure.
 */
export const actionCard: MessagesFor<"actionCard"> = {
  fallbackCategory: "Actie",
  rankLabel: "#{rank}",
  priorityBadge: "prioriteit {priority}",
  priorityLabel: {
    critical: "kritiek",
    high: "hoog",
    medium: "gemiddeld",
    low: "laag",
  },
  impactLabel: {
    high: "hoog",
    medium: "gemiddeld",
    low: "laag",
  },
  effortLabel: {
    low: "laag",
    medium: "gemiddeld",
    high: "hoog",
    small: "klein",
    large: "groot",
  },
  statusLabel: {
    open: "open",
    acknowledged: "bevestigd",
    in_progress: "in behandeling",
    resolved: "opgelost",
  },
  factorsLabel: "Prioriteitsfactoren",
  impact: "Impact",
  effort: "Inspanning",
  confidence: "Betrouwbaarheid",
  priorityScore: "Prioriteitsscore",
  workflowStatus: "Workflowstatus",
  workflowStatusFor: "Workflowstatus voor {title}",
  savingStatus: "Status opslaan…",
  whyPrioritized: "Waarom dit prioriteit heeft",
  noPriorityExplanation: "De API gaf geen uitleg bij de prioriteit.",
  evidenceSummary: "Bewijs en reikwijdte",
  noEvidence: "Er is geen ondersteunend bewijs teruggegeven voor deze actie.",
} as const;
