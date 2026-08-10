/** Issue review: filters, the evidence table, and the adjudication editor. */
import type { MessagesFor } from "../types";

export const issues: MessagesFor<"issues"> = {
  eyebrow: "Control de calidad",
  title: "Revisión de problemas",
  description:
    "Inspecciona la evidencia del rastreo, documenta las excepciones intencionales y mantén los falsos positivos fuera de las prioridades futuras sin borrar el historial de auditorías.",
  filters: {
    title: "Separa la señal del comportamiento aceptado",
    description:
      "Busca títulos, reglas, módulos, huellas y URLs canónicas. Las decisiones se limitan al sitio seleccionado.",
    reset: "Restablecer filtros",
    searchLabel: "Buscar problemas",
    searchPlaceholder: "Regla, URL, título, huella…",
    status: "Estado",
    allStatuses: "Todos los estados",
    statusOpen: "Abiertos",
    statusResolved: "Resueltos por auditoría",
    statusIgnored: "Ignorados intencionalmente",
    statusFalsePositive: "Falsos positivos",
    severity: "Severidad",
    allSeverities: "Todas las severidades",
    severityCritical: "Crítica",
    severityHigh: "Alta",
    severityMedium: "Media",
    severityLow: "Baja",
    severityInfo: "Info",
  },
  showingRange: "Mostrando {start}–{end} de {total} problemas",
  tableLabel: "Problemas SEO en espera de decisión de revisión o con ella",
  columns: {
    severity: "Severidad",
    issue: "Problema",
    url: "URL",
    status: "Estado",
    occurrences: "Apariciones",
    lastSeen: "Visto por última vez",
    review: "Revisión",
  },
  siteWide: "Todo el sitio",
  /** Keyed by the API's `IssueStatus` enum; fall back to the raw value. */
  statusLabel: {
    open: "abierto",
    resolved: "resuelto",
    ignored: "ignorado",
    false_positive: "falso positivo",
  },
  hide: "Ocultar",
  review: "Revisar",
  paginationLabel: "Páginas de problemas",
  previous: "Anterior",
  next: "Siguiente",
  pageOf: "Página {page} de {total}",
  emptyFilteredTitle: "Ningún problema coincide",
  emptyFilteredBody:
    "Amplía los filtros o busca otra regla, módulo, título o URL.",
  emptyOpenTitle: "Sin problemas abiertos",
  emptyOpenBody:
    "Ejecuta una auditoría para recopilar evidencia de problemas, o cambia el filtro de estado para revisar hallazgos resueltos.",
  editor: {
    eyebrow: "Revisión de evidencia",
    close: "Cerrar revisión",
    rule: "Regla",
    module: "Módulo",
    firstSeen: "Visto por primera vez",
    occurrences: "Apariciones",
    evidenceTitle: "Evidencia capturada",
    structuredEvidence: "Evidencia estructurada",
    noEvidence:
      "Este hallazgo no tiene payload de evidencia estructurada. Revisa la regla, la URL y el historial de auditorías antes de clasificarlo.",
    decision: "Decisión de revisión",
    keepTitle: "Mantener accionable",
    keepBody:
      "Elimina cualquier anulación manual y evalúa las ejecuciones futuras con normalidad.",
    ignoreTitle: "Ignorar intencionalmente",
    ignoreBody:
      "El comportamiento es real, se entiende y se acepta para este sitio.",
    falsePositiveTitle: "Marcar como falso positivo",
    falsePositiveBody:
      "La regla no describe correctamente esta página o implementación.",
    reasonLabel: "Motivo de la revisión",
    reasonRequired: "(obligatorio)",
    reasonOptional: "(opcional)",
    reasonPlaceholder:
      "Explica el contexto del sitio para que otro marketer pueda verificar esta decisión más adelante.",
    charCount: "{count} / 2.000 caracteres",
    confirmation:
      "Revisé la evidencia. Mantener esta clasificación en futuras auditorías hasta que alguien la reabra.",
    saved:
      "Revisión guardada. Las acciones y las prioridades del resumen se actualizaron.",
    saving: "Guardando…",
    save: "Guardar revisión",
    retention:
      "La evidencia de auditoría sin procesar y el historial nunca se eliminan.",
  },
} as const;
