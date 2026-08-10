/** The decision-center overview: health hero, metric grid, source health. */
import type { MessagesFor } from "../types";

export const overview: MessagesFor<"overview"> = {
  eyebrow: "Centro de decisiones",
  siteTitle: "Resumen de {name}",
  fallbackTitle: "Tu resumen de marketing",
  description:
    "Mira qué cambió, qué importa y qué movimiento tiene más probabilidades de mejorar los resultados.",
  startingAudit: "Iniciando auditoría…",
  runFullAudit: "Ejecutar auditoría completa",
  auditNotStartedTitle: "La auditoría no pudo iniciarse",
  auditQueuedTitle: "Auditoría en cola",
  auditQueuedBody:
    "La auditoría fue aceptada. Sigue su progreso desde el espacio de Auditorías.",
  health: {
    eyebrow: "Salud del sitio",
    title: "Una línea base clara para tu próxima decisión",
    body: "La puntuación de salud combina las señales devueltas por tus fuentes de auditoría configuradas. Las entradas ausentes permanecen visibles.",
    reviewActions: "Revisar acciones priorizadas",
    currentScore: "Puntuación actual",
    pointsVsPriorAudit: "{change} puntos de salud vs auditoría anterior",
    comparisonUnavailable: "Comparación no disponible",
  },
  regressions: {
    eyebrow: "Vigilar ahora",
    title: "Regresiones críticas",
    body: "Problemas que pueden necesitar triaje inmediato.",
    openQueue: "Abrir cola de acciones",
  },
  performance: {
    title: "Rendimiento de un vistazo",
    description:
      "Resultados de marketing y cobertura técnica, sin convertir los datos ausentes en cero.",
    organicClicks: "Clics orgánicos",
    organicClicksHelp: "Conecta Search Console para tener comparaciones",
    organicKeyEvents: "Eventos clave orgánicos",
    organicKeyEventsHelp: "Conecta GA4 para medir resultados orgánicos",
    indexableCoverage: "Cobertura indexable",
    coreWebVitalsPassRate: "Tasa de aprobación de Core Web Vitals",
  },
  topActions: {
    title: "Top 5 acciones",
    description:
      "Ordenadas por impacto estimado, esfuerzo, confianza y la evidencia proporcionada por la API.",
    viewAll: "Ver todas las acciones",
    emptyTitle: "Aún no hay acciones priorizadas",
    emptyDescription:
      "Ejecuta una auditoría base tras conectar tus fuentes de datos. Un resultado vacío válido se muestra vacío — no como una puntuación perfecta.",
  },
  trendTitle: "Tendencia de la puntuación de salud",
  sources: {
    title: "Salud de las fuentes de datos",
    description: "Sabe qué entradas sostienen esta vista.",
    manage: "Gestionar",
    updated: "Actualizado {date}",
    coverage: "{value}% de cobertura",
    unavailableTitle: "Estado de las fuentes no disponible",
    unavailableBody: "La API no identificó las fuentes detrás de este resumen.",
  },
} as const;
