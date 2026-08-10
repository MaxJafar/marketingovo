/**
 * The Actions workbench: queue filters, the prioritized table, and the
 * marketer workflow controls.
 */
import type { MessagesFor } from "../types";

export const actions: MessagesFor<"actions"> = {
  eyebrow: "Mesa de trabajo de evidencia a resultado",
  title: "Acciones",
  description:
    "Prioriza, investiga, asigna y verifica el trabajo SEO sin separar la evidencia técnica de la exposición de negocio.",
  statusNotSavedTitle: "El estado de la acción no se guardó",
  filterTitle: "Encuentra el trabajo que importa ahora",
  filterDescription:
    "Busca por recomendación, regla, módulo o responsable. La evidencia ausente permanece como no disponible y nunca se convierte en cero.",
  resetFilters: "Restablecer filtros",
  searchLabel: "Buscar acciones",
  searchPlaceholder: "Canonical, enlaces rotos, responsable…",
  statusFilterLabel: "Estado",
  allStatuses: "Todos los estados",
  verificationFilterLabel: "Verificación",
  allVerification: "Toda la verificación",
  effortFilterLabel: "Esfuerzo",
  allEffort: "Todo el esfuerzo",
  effortOption: {
    low: "Bajo",
    medium: "Medio",
    high: "Alto",
  },
  sortByLabel: "Ordenar por",
  sortOption: {
    priority: "Puntuación de prioridad",
    updated: "Actualización más reciente",
    affected: "URLs afectadas",
    confidence: "Confianza",
  },
  priorityLegend: "Prioridad",
  priorityGroupLabel: "Filtrar acciones por prioridad",
  priorityFilter: {
    all: "Todas",
    critical: "Crítica",
    high: "Alta",
    medium: "Media",
    low: "Baja",
  },
  showingCount: "Mostrando {visible} de {total} acciones",
  tableLabel: "Acciones SEO priorizadas",
  columnPriority: "Prioridad",
  columnAction: "Acción y grupo de evidencia",
  columnScope: "Alcance",
  columnEffort: "Esfuerzo",
  columnConfidence: "Confianza",
  columnWorkflow: "Flujo",
  columnVerification: "Verificación",
  columnUpdated: "Actualizada",
  statusLabel: {
    open: "abierta",
    acknowledged: "reconocida",
    in_progress: "en curso",
    resolved: "resuelta",
  },
  verificationLabel: {
    pending: "pendiente",
    verified: "verificada",
    regressed: "con regresión",
  },
  moduleUnavailable: "Módulo no disponible",
  ruleUnavailable: "Regla no disponible",
  affectedUrls: "URLs afectadas",
  organicVisitsExposed: "{count} visitas orgánicas expuestas",
  businessExposureUnavailable: "Exposición de negocio no disponible",
  workflowStatusFor: "Estado del flujo para {title}",
  saving: "Guardando…",
  emptyFilteredTitle: "Ninguna acción coincide con estos filtros",
  emptyFilteredDescription:
    "Restablece uno o más filtros para volver a la cola completa respaldada por evidencia.",
  emptyQueueTitle: "Aún no hay acciones priorizadas",
  emptyQueueDescription:
    "Ejecuta una auditoría para generar la primera cola de acciones. Un resultado vacío válido nunca se presenta como una puntuación perfecta.",
} as const;
