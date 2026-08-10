/**
 * The action evidence and verification workbench: summary cards, the score
 * explanation, source health, occurrence history, and per-URL evidence.
 */
import type { MessagesFor } from "../types";

export const actionDetail: MessagesFor<"actionDetail"> = {
  backToActions: "Volver a acciones",
  eyebrow: "Evidencia y verificación de la acción",
  fallbackTitle: "Mesa de trabajo de la acción",
  description:
    "Rastrea la recomendación hasta cada URL observada, separa la evidencia técnica del contexto de negocio y verifica la corrección con una ejecución de seguimiento duradera.",
  workflowStatus: "Estado del flujo",
  statusLabel: {
    open: "abierta",
    acknowledged: "reconocida",
    in_progress: "en curso",
    resolved: "resuelta",
  },
  workflowNotSavedTitle: "El estado del flujo no se guardó",
  summaryLabel: "Resumen de la acción",
  technicalEvidence: "Evidencia técnica",
  affectedUrls: "URLs afectadas",
  issueOccurrences:
    "{count} apariciones del problema en el historial de auditorías cargado.",
  lifecycleSummary: {
    new: "Nuevo",
    persistent: "Persistente",
    resolved: "Resuelto",
    reappeared: "Reaparecido",
  },
  businessContext: "Contexto de negocio",
  businessSummary: {
    observedClicks: "clics observados",
    impressions: "impresiones",
    organicKeyEvents: "eventos clave orgánicos",
  },
  exposureNote:
    "La exposición explica por qué importa la acción. Es contexto observado — no una promesa de que resolver el problema creará la misma cantidad de tráfico incremental.",
  whyNow: "Por qué ahora",
  module: "Módulo",
  impact: "Impacto",
  effort: "Esfuerzo",
  confidence: "Confianza",
  created: "Creada",
  updated: "Actualizada",
  proofLoop: "Ciclo de prueba",
  proofLoopTitle: "Corregir → punto de control → verificar",
  verificationTitle: "Verificación {state}",
  verificationStateLabel: {
    not_started: "sin iniciar",
    queued: "en cola",
    running: "en ejecución",
    verified: "verificada",
    regressed: "con regresión",
    inconclusive: "no concluyente",
  },
  verificationFallback:
    "Crea un punto de control antes de implementar y luego ejecuta una verificación dirigida cuando la corrección esté desplegada.",
  checkpoint: "Punto de control",
  notCreated: "Sin crear",
  verificationRun: "Ejecución de verificación",
  notStarted: "Sin iniciar",
  coverage: "Cobertura",
  checked: "Comprobado",
  checkpointNotCreatedTitle: "El punto de control no se creó",
  verificationNotStartedTitle: "La verificación no se inició",
  creatingCheckpoint: "Creando punto de control…",
  replaceCheckpoint: "Reemplazar punto de control",
  createCheckpoint: "Crear punto de control",
  verificationRunning: "Verificación en curso…",
  verifyCurrentFix: "Verificar la corrección actual",
  checkpointHelp:
    "Un punto de control preserva el estado previo necesario para un resultado de verificación defendible.",
  scoreInputsUnavailableTitle: "Entradas de la puntuación no disponibles",
  scoreInputsUnavailableBody:
    "La API devolvió una puntuación de prioridad sin sus entradas reproducibles.",
  scoreTitle: "Por qué esta acción está priorizada",
  scoreDescription:
    "La puntuación es una heurística de priorización transparente, no un pronóstico de tráfico. Todas las entradas normalizadas están entre 0 y 1.",
  unknownModel: "Modelo desconocido",
  formulaLabel: "Fórmula de la versión uno de prioridad",
  formula:
    "prioridad = 100 × (0,35×severidad + 0,25×exposición orgánica + 0,15×exposición a conversión + 0,15×alcance de URLs + 0,10×confianza) × multiplicador de esfuerzo",
  scoreTermLabel: {
    severity: "Severidad",
    organicExposure: "Exposición orgánica",
    conversionExposure: "Exposición a conversión",
    urlReach: "Alcance de URLs",
    confidence: "Confianza",
  },
  weightContribution: "Peso {weight}% · contribución {contribution}",
  neutralSubstitute: "Sustituto neutro de 0,50; la confianza se reduce.",
  effortMultiplier: "Multiplicador de esfuerzo",
  effortUnavailable: "Esfuerzo no disponible",
  storedScore: "Puntuación guardada",
  reproducedScore: "Reproducida a partir de las entradas",
  noEvidenceValues: "No se devolvieron valores de evidencia.",
  observedAt: "Observado {date}",
  structuredEvidence: "Evidencia estructurada",
  sourceStateUnavailableTitle: "Estado de las fuentes no disponible",
  sourceStateUnavailableBody:
    "La API no identificó qué fuentes respaldan esta evidencia.",
  sourceUpdated: "Actualizado {date}",
  coverageUnavailable: "Cobertura no disponible",
  coveragePercent: "{coverage}% de cobertura",
  indexable: "Indexable",
  notIndexable: "No indexable",
  indexabilityUnavailable: "Indexabilidad no disponible",
  httpStatus: "HTTP {code}",
  firstLastSeen:
    "Visto por primera vez {firstSeen} · Visto por última vez {lastSeen}",
  noActiveIssue:
    "Ninguna aparición activa del problema está adjunta a esta instantánea.",
  metric: {
    lcp: "LCP",
    cls: "CLS",
    ttfb: "TTFB",
    clicks: "Clics",
    impressions: "Impresiones",
    ctr: "CTR",
    position: "Posición",
    sessions: "Sesiones",
    keyEvents: "Eventos clave",
  },
  searchExposure: "Exposición en búsqueda",
  searchExposureNote:
    "Demanda observada en Search Console, no una ganancia de tráfico pronosticada.",
  organicOutcomes: "Resultados orgánicos",
  organicOutcomesNote:
    "Resultados observados en GA4; la correlación no garantiza mejora.",
  periodUnavailable: "Periodo no disponible",
  periodRange: "{start} – {end}",
  inspectRawEvidence: "Inspeccionar evidencia sin procesar ({count})",
  sourceHealthTitle: "Salud de las fuentes de evidencia",
  sourceHealthDescription:
    "La frescura y la cobertura matizan cada afirmación técnica o de negocio de arriba.",
  historyTitle: "Historial de apariciones",
  historyDescription:
    "El mismo grupo de evidencia a lo largo de las ejecuciones de auditoría completadas.",
  historyUrls: "{count} URLs",
  openRun: "Abrir ejecución",
  noHistoryTitle: "Sin historial de apariciones",
  noHistoryDescription:
    "Se requiere una segunda auditoría para distinguir evidencia nueva, persistente, resuelta y reaparecida.",
  affectedUrlEvidenceTitle: "Evidencia de URLs afectadas",
  affectedUrlEvidenceDescription:
    "Inspecciona los hechos técnicos, la exposición en Search Console, los resultados de GA4 y la evidencia del problema sin procesar, sin mezclar sus afirmaciones.",
  searchLoadedUrls: "Buscar en las URLs cargadas",
  urlSearchPlaceholder: "URL, título de página o problema",
  lifecycle: "Ciclo de vida",
  allLifecycleStates: "Todos los estados del ciclo de vida",
  lifecycleLabel: {
    new: "nuevo",
    persistent: "persistente",
    resolved: "resuelto",
    reappeared: "reaparecido",
  },
  matchingCount: "{matching} coincidentes · {loaded} cargadas de {total}",
  noLoadedUrlsTitle: "Ninguna URL cargada coincide",
  noLoadedUrlsDescription:
    "Cambia la búsqueda de URL o el filtro de ciclo de vida. La evidencia ausente sigue visible en los resultados sin filtrar.",
  loadingEvidence: "Cargando evidencia…",
  loadMoreUrls: "Cargar 100 URLs más",
} as const;
