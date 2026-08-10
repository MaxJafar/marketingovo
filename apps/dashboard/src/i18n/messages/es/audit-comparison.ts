/** The audit comparison card: run pair selection and the evidence delta. */
import type { MessagesFor } from "../types";

export const auditComparison: MessagesFor<"auditComparison"> = {
  eyebrow: "Inteligencia de instantáneas",
  title: "Comparar ejecuciones de auditoría",
  description:
    "Separa las regresiones de las correcciones verificadas usando evidencia inmutable de problemas y páginas. No se inicia ningún rastreo nuevo.",
  state: {
    comparable: "Comparable",
    partial: "Evidencia parcial",
    unavailable: "Evidencia de páginas no disponible",
  },
  emptyTitle: "Se requieren dos auditorías completadas",
  emptyBody:
    "Ejecuta una línea base y una auditoría de seguimiento. Las ejecuciones de investigación de palabras clave, contenido y competidores quedan fuera del historial técnico.",
  baselineAudit: "Auditoría base",
  currentAudit: "Auditoría actual",
  openBaselineEvidence: "Abrir evidencia base",
  openCurrentEvidence: "Abrir evidencia actual",
  loading: "Calculando el delta de evidencia…",
  errorTitle: "Comparación no disponible",
  regressionPressure: "Presión de regresión",
  scoreExplainer:
    "Los problemas nuevos suman peso por severidad (crítico 8, alto 5, medio 3, bajo 1); las correcciones lo restan. Las regresiones HTTP suman 3 y las de indexabilidad suman 2. Un valor negativo es mejora neta.",
  summary: {
    newWorse: "Problemas nuevos / peores",
    resolvedReduced: "Resueltos / reducidos",
    healthChange: "Cambio en salud SEO",
    pageRegressions: "Regresiones de páginas",
    pagesCaptured: "Páginas capturadas",
    reviewedExcluded: "Ruido revisado excluido",
  },
  configuration: "Configuración",
  configMatched:
    "Los ajustes de rastreo guardados coinciden en ambas instantáneas.",
  configDifferent: "Entradas distintas: {differences}.",
  configUnavailable:
    "Los ajustes guardados no están disponibles, así que no puede probarse la equivalencia de alcance.",
  configFingerprints: "Huellas de configuración: {baseline}… → {current}…",
  warningsTitle: "Notas de interpretación",
  columns: {
    finding: "Hallazgo",
    change: "Cambio",
    url: "URL",
    before: "Antes",
    after: "Después",
    source: "Origen",
    target: "Destino",
    beforeAfter: "Antes → después",
  },
  regressions: {
    title: "Regresiones de problemas",
    description: "Hallazgos nuevos y hallazgos cuya severidad aumentó.",
    caption: "Problemas SEO nuevos y empeorados",
    empty: "No se detectaron problemas efectivos nuevos ni empeorados.",
  },
  fixes: {
    title: "Correcciones verificadas",
    description: "Hallazgos ausentes o reducidos en la instantánea actual.",
    caption: "Problemas SEO resueltos y reducidos",
    empty: "No se verificó la resolución de ningún problema en este par.",
  },
  pages: {
    title: "Cambios de páginas",
    description: "Estado, indexabilidad, adiciones y eliminaciones.",
    caption: "Cambios a nivel de página entre instantáneas de auditoría",
    empty: "No se capturaron cambios a nivel de página para este par.",
  },
  links: {
    title: "Cambios de enlaces internos",
    description:
      "Aristas exactas de origen a destino a partir de grafos de rastreo inmutables. La creación y recuperación de enlaces rotos se clasifican; la estructura editorial permanece neutral.",
    graphCoverage: "Cobertura del grafo",
    edgesCaptured: "Aristas capturadas",
    addedRemoved: "Añadidas / eliminadas",
    modified: "Modificadas",
    regressionsRecoveries: "Regresiones / recuperaciones",
    warningsTitle: "Notas de la comparación de enlaces",
    caption: "Cambios de enlaces internos entre instantáneas de auditoría",
    emptyUnavailable:
      "Reproduce ambas auditorías para capturar evidencia comparable de enlaces internos.",
    empty:
      "No se capturaron cambios en aristas de enlaces internos para este par.",
  },
  siteWide: "Todo el sitio",
  notInSnapshot: "No está en la instantánea",
  indexabilityUnknown: "indexabilidad desconocida",
  indexable: "indexable",
  notIndexable: "no indexable",
  statusUnavailable: "estado no disponible",
  notPresent: "No presente",
  occurrenceOne: "{count} aparición",
  occurrenceOther: "{count} apariciones",
  truncationNotice:
    "La respuesta de la API alcanzó un límite de seguridad. Exporta los datos de la ejecución o usa el SDK para el corpus guardado completo.",
} as const;
