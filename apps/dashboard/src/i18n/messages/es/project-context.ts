/** Project context page: versioned profile, journal, and revision history. */
import type { MessagesFor } from "../types";

export const projectContext: MessagesFor<"projectContext"> = {
  eyebrow: "Memoria estratégica reutilizable",
  title: "Contexto del proyecto",
  description:
    "Mantén los objetivos de negocio, las audiencias, los mercados, las restricciones y las decisiones junto a la evidencia del rastreo para que cada persona y agente parta de los mismos hechos.",
  revisionSavedTitle: "Revisión de contexto guardada",
  revisionSavedBody:
    "La revisión anterior permanece inmutable y disponible en el historial.",
  revisionNotSavedTitle: "El contexto no se guardó",
  journalAppendedTitle: "Entrada del diario añadida",
  journalAppendedBody:
    "La entrada es inmutable y ahora está disponible para los recursos de agentes locales.",
  journalNotAppendedTitle: "La entrada del diario no se añadió",
  revisionLabel: "Revisión {revision}",
  profile: {
    eyebrow: "Perfil versionado",
    createFirstRevision: "Crear la primera revisión",
    savedAt: "Guardado {date}",
    summaryLabel: "Resumen de negocio y búsqueda",
    summaryPlaceholder:
      "¿Qué ofrece el negocio, a quién, y qué debe lograr ahora la búsqueda orgánica?",
    oneItemPerLine: "Un elemento por línea.",
    changeSummaryLabel: "Resumen de la revisión",
    changeSummaryPlaceholder:
      "Añadido el mercado del Reino Unido y aclarada la conversión de demo",
    changeSummaryHelp:
      "Explica qué cambió. Guardar siempre crea una nueva revisión inmutable.",
    saving: "Guardando revisión…",
    save: "Guardar nueva revisión",
  },
  profileLists: {
    audiences: {
      label: "Audiencias prioritarias",
      help: "¿Quién debe encontrar este sitio, confiar en él y actuar?",
      placeholder: "Responsables de SEO técnico\nEquipos de crecimiento B2B",
    },
    markets: {
      label: "Mercados",
      help: "Países, regiones o segmentos comerciales que cambian la intención.",
      placeholder: "Estados Unidos\nReino Unido",
    },
    languages: {
      label: "Idiomas",
      help: "Usa las etiquetas que tu equipo reconoce; incluye la variante regional cuando sea relevante.",
      placeholder: "Inglés (en-US)\nAlemán (de-DE)",
    },
    conversionGoals: {
      label: "Objetivos de conversión",
      help: "Nombra los eventos que hacen valioso el trabajo orgánico.",
      placeholder: "Solicitud de demo cualificada\nActivación de prueba",
    },
    priorityTopics: {
      label: "Temas prioritarios",
      help: "Productos, problemas o temas que la estrategia actual debe respaldar.",
      placeholder: "Automatización de SEO técnico\nAnalítica local-first",
    },
    competitors: {
      label: "Competidores conocidos",
      help: "Marcas o dominios usados para una comparación justa y explícita.",
      placeholder: "competidor-ejemplo.com\nLíder alternativo de la categoría",
    },
    constraints: {
      label: "Restricciones y salvaguardas",
      help: "Límites legales, de marca, de plataforma, de migración o de recursos.",
      placeholder:
        "No cambiar las URLs del checkout\nRevisión legal obligatoria para las afirmaciones",
    },
  },
  journalKinds: {
    observation: "Observación",
    decision: "Decisión",
    constraint: "Restricción",
    experiment: "Experimento",
  },
  journalForm: {
    eyebrow: "Diario de solo escritura",
    heading: "Registra lo que cambió la estrategia",
    kindLabel: "Tipo de entrada",
    sourceLabel: "Auditoría de origen (opcional)",
    noLinkedAudit: "Sin auditoría vinculada",
    titleLabel: "Título de la entrada",
    titlePlaceholder:
      "Las páginas de comparación del Reino Unido convierten demos cualificadas",
    detailLabel: "Evidencia e implicación",
    detailPlaceholder:
      "Indica qué se observó o decidió, por qué importa y qué lo invalidaría.",
    appending: "Añadiendo…",
    append: "Añadir entrada al diario",
    immutableNote:
      "Las entradas no se pueden editar en el sitio. Añade una decisión posterior cuando la evidencia cambie.",
  },
  journalHistory: {
    heading: "Diario de decisiones",
    description:
      "Las entradas más nuevas aparecen primero; los números de secuencia nunca cambian.",
    sourceRun: "Ejecución de origen: {id}",
    emptyTitle: "Aún no hay diario de estrategia",
    emptyDescription:
      "Añade una observación, decisión, restricción o experimento cuando la evidencia cambie cómo debe actuar el equipo.",
  },
  revisionHistory: {
    heading: "Historial de revisiones",
    description:
      "Las revisiones del perfil son inmutables y van de la más nueva a la más antigua.",
  },
} as const;
