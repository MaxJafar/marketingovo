/** Keyword lab: research workflows, provider usage, clusters, opportunities. */
import type { MessagesFor } from "../types";

export const keywords: MessagesFor<"keywords"> = {
  eyebrow: "Inteligencia de demanda",
  title: "Palabras clave y contenido",
  description:
    "Encuentra oportunidades de búsqueda, agrupa la intención y convierte la demanda en un plan de contenido enfocado.",
  starting: "Iniciando…",
  research: {
    title: "Investigar un mercado",
    description:
      "Expande una semilla a través de sugerencias, intención, Trends, PAA y búsquedas relacionadas.",
    seedLabel: "Palabra clave semilla",
    start: "Iniciar investigación de palabras clave",
  },
  plan: {
    title: "Construir un plan de contenido",
    description:
      "Introduce hasta diez temas semilla, separados por comas o saltos de línea.",
    seedsLabel: "Temas semilla",
    generate: "Generar plan de contenido",
  },
  notStartedTitle: "La investigación no pudo iniciarse",
  queuedTitle: "Investigación en cola",
  queuedBody:
    "La ejecución duradera es visible en Auditorías. Esta página mostrará el último resultado de investigación completado.",
  usage: {
    title: "Uso de proveedores en la última investigación",
    reported:
      "${cost} fue reportado por proveedores medidos en {billable} solicitud(es) facturable(s).",
    unreported:
      "{count} solicitud(es) facturable(s) no reportaron un costo por llamada y no se muestran como cero.",
    allReported:
      "Todas las llamadas facturables de este resultado reportaron su costo.",
    free: "{count} solicitud(es) completada(s) usaron fuentes conocidas como gratuitas.",
  },
  clusters: {
    title: "Clústeres de contenido",
    description:
      "Cobertura y orientación para briefs desde la fuente de palabras clave conectada.",
    keywordCount: "{count} palabras clave",
    coverage: "Cobertura de contenido",
    coverageUnavailable: "Medición de cobertura no disponible",
    noBrief: "No hay recomendación de brief disponible.",
    emptyTitle: "Sin clústeres de contenido",
    emptyBody:
      "Conecta un proveedor de palabras clave o importa datos de palabras clave para construir clústeres temáticos.",
  },
  opportunities: {
    title: "Oportunidades de palabras clave",
    description:
      "Prioriza la demanda usando posición, volumen de búsqueda, dificultad y puntuación de oportunidad.",
    tableLabel: "Oportunidades de palabras clave",
    emptyTitle: "Sin oportunidades de palabras clave",
    emptyBody: "La API devolvió un conjunto de oportunidades vacío y válido.",
    columns: {
      keyword: "Palabra clave",
      intent: "Intención",
      position: "Posición",
      volume: "Volumen",
      difficulty: "Dificultad",
      opportunity: "Oportunidad",
      target: "Página objetivo",
    },
    noCluster: "Sin clúster",
    openPage: "Abrir página",
    invalidUrl: "URL no válida",
    unassigned: "Sin asignar",
  },
} as const;
