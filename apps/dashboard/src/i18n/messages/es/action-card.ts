/**
 * The single-action card used on dashboard surfaces: decision factors, the
 * workflow control, and the evidence disclosure.
 */
import type { MessagesFor } from "../types";

export const actionCard: MessagesFor<"actionCard"> = {
  fallbackCategory: "Acción",
  rankLabel: "#{rank}",
  priorityBadge: "prioridad {priority}",
  priorityLabel: {
    critical: "crítica",
    high: "alta",
    medium: "media",
    low: "baja",
  },
  impactLabel: {
    high: "alto",
    medium: "medio",
    low: "bajo",
  },
  effortLabel: {
    low: "bajo",
    medium: "medio",
    high: "alto",
    small: "pequeño",
    large: "grande",
  },
  statusLabel: {
    open: "abierta",
    acknowledged: "reconocida",
    in_progress: "en curso",
    resolved: "resuelta",
  },
  factorsLabel: "Factores de prioridad",
  impact: "Impacto",
  effort: "Esfuerzo",
  confidence: "Confianza",
  priorityScore: "Puntuación de prioridad",
  workflowStatus: "Estado del flujo",
  workflowStatusFor: "Estado del flujo para {title}",
  savingStatus: "Guardando estado…",
  whyPrioritized: "Por qué está priorizada",
  noPriorityExplanation:
    "La API no proporcionó una explicación de la prioridad.",
  evidenceSummary: "Evidencia y alcance",
  noEvidence: "No se devolvió evidencia que respalde esta acción.",
} as const;
