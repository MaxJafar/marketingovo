/** Competitors: the comparison workflow and crawl-evidence cards. */
import type { MessagesFor } from "../types";

export const competitors: MessagesFor<"competitors"> = {
  eyebrow: "Contexto de mercado",
  title: "Competidores",
  description:
    "Evidencia de rastreo, cadencia de publicación y brechas de contenido, todo obtenido del propio sitio de cada rival — sin necesidad de clave de proveedor. Las brechas a nivel de palabra clave permanecen explícitamente no disponibles hasta que un proveedor compatible las aporte.",
  form: {
    title: "Ejecutar una comparación reproducible",
    description:
      "Introduce uno o dos dominios de competidores. Cada sitio se rastrea con los mismos límites; esta vista reporta evidencia técnica, no datos de visibilidad inventados.",
    domainsLabel: "Dominios de competidores",
    starting: "Iniciando…",
    submit: "Comparar sitios",
  },
  notStartedTitle: "La comparación no pudo iniciarse",
  queuedTitle: "Comparación en cola",
  queuedBody:
    "La ejecución duradera es visible en Auditorías. Esta página mostrará la última comparación completada.",
  card: {
    updated: "Actualizado {date}",
    publishesEvery: "Publica cada",
    cadenceDays: "{count} días",
    cadenceUnavailableHint:
      "No se encontró ningún feed, o el feed tenía muy pocas publicaciones con fecha para medir un intervalo.",
    lastPublished: "Última publicación",
    daysAgo: "hace {count} días",
    technicalHealth: "Salud técnica",
    change: "Cambio",
    changeUnavailableHint:
      "Ninguna comparación anterior incluye este sitio, así que no hay línea base contra la que moverse.",
    noChange: "Sin cambios",
    changePts: "{value} pts",
    sharedKeywords: "Palabras clave compartidas",
    keywordGaps: "Brechas de palabras clave",
    coversGapTopics: "Cubre temas con brecha",
  },
  emptyTitle: "Sin competidores configurados",
  emptyBody:
    "Añade dominios de competidores mediante la API o el flujo de configuración para desbloquear el contexto de mercado.",
  gaps: {
    title: "Temas que ellos cubren y tú no",
    description:
      "Derivado de las propias páginas, así que no hace falta ningún proveedor de palabras clave. Cada término aparece en las páginas del competidor con una densidad sustancialmente mayor que en tu sitio.",
    coverageOne: "en {covering} de {total} sitio comparado",
    coverageMany: "en {covering} de {total} sitios comparados",
  },
} as const;
