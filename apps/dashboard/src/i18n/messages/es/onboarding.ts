/** Guided setup: the seven-step onboarding checklist and its cards. */
import type { MessagesFor } from "../types";

export const onboarding: MessagesFor<"onboarding"> = {
  eyebrow: "Configuración guiada",
  title: "Llega a tu primer insight útil",
  description:
    "Crea un espacio de trabajo, elige la evidencia y el resultado, y activa la monitorización periódica. El sitio web es opcional y desbloquea el rastreo y las auditorías.",
  apiUnavailableTitle: "La API local no está disponible",
  progressLabel: "Progreso de la incorporación",
  progressSummary: "Paso {current} de {total}: {label}.",
  stepCompleted: "Completado.",
  stepOptionalIncomplete: "Opcional, no completado.",
  stepCurrent: "Paso actual.",
  stepIncomplete: "No completado.",
  steps: {
    createWorkspace: {
      label: "Crea un espacio de trabajo",
      description: "Nombra la marca a la que pertenece este espacio.",
    },
    addWebsite: {
      label: "Añade un sitio web",
      description:
        "Opcional. Solo es necesario para el rastreo y las auditorías SEO.",
    },
    connectData: {
      label: "Conecta datos",
      description: "Conecta una fuente o elige el análisis solo con rastreo.",
    },
    chooseGoal: {
      label: "Elige un objetivo",
      description: "Dile a la auditoría qué resultado importa ahora.",
    },
    runBaseline: {
      label: "Ejecuta una línea base",
      description: "Crea tu primera instantánea técnica.",
    },
    reviewActions: {
      label: "Revisa las acciones",
      description: "Elige el siguiente movimiento de mayor valor.",
    },
    activateMonitoring: {
      label: "Activa la monitorización",
      description: "Programa auditorías periódicas contra regresiones.",
    },
  },
  goals: {
    technicalHealth: {
      title: "Mejorar la salud técnica",
      description:
        "Prioriza indexabilidad, rastreabilidad, rendimiento y regresiones.",
    },
    qualifiedTraffic: {
      title: "Aumentar el tráfico cualificado",
      description:
        "Encuentra las páginas y consultas con el mayor potencial realista.",
    },
    organicKeyEvents: {
      title: "Incrementar los eventos clave orgánicos",
      description:
        "Pondera las recomendaciones según la analítica y la exposición a conversiones.",
    },
    contentOpportunities: {
      title: "Planificar oportunidades de contenido",
      description:
        "Descubre brechas temáticas y convierte la demanda en un plan respaldado por evidencia.",
    },
  },
  loading: {
    kicker: "Comprobando la API local",
    title: "Cargando tu espacio de trabajo…",
    body: "El panel está confirmando si ya hay un sitio configurado.",
  },
  create: {
    kicker: "Paso 1 de 7",
    title: "Crea tu primer espacio de trabajo",
    body: "Un espacio de trabajo reúne los canales, la investigación y las notas de esta marca. El sitio web es opcional — añade uno solo si quieres rastreo y auditorías SEO.",
    notAddedTitle: "El sitio no se añadió",
    addedTitle: "Sitio añadido",
    addedBody:
      "Continúa conectando al menos una fuente o eligiendo el análisis solo con rastreo.",
    nameLabel: "Nombre del espacio de trabajo",
    urlLabel: "URL canónica",
    optional: "Opcional",
    urlHelp:
      "Déjalo en blanco para trabajar primero en social, anuncios e investigación. Puedes añadir un sitio web en cualquier momento desde Ajustes.",
    creating: "Creando espacio de trabajo…",
    submit: "Crear espacio de trabajo",
  },
  workspace: {
    kicker: "Espacio de trabajo activo",
    noWebsite:
      "Sin sitio web — el rastreo y las auditorías están desactivados.",
  },
  evidence: {
    kicker: "Paso 3 de 7",
    title: "Elige tu evidencia",
    body: "Conecta las plataformas en las que tu equipo confía, o empieza con datos de rastreo y añade integraciones después. Las fuentes ausentes reducen la confianza; nunca se convierten en ceros falsos.",
    connectedIntegrations: "integraciones conectadas",
    crawlOnlyTitle: "Análisis solo con rastreo seleccionado",
    crawlOnlyBody:
      "La línea base puede ejecutarse ya. Conecta GSC o GA4 más adelante para mejorar la confianza y la puntuación de exposición.",
    manageIntegrations: "Gestionar integraciones",
    crawlOnlyButton: "Continuar solo con datos de rastreo",
  },
  goal: {
    kicker: "Paso 4 de 7",
    title: "Elige el resultado que importa ahora",
    body: "El objetivo seleccionado se guarda con la ejecución de la auditoría para que su propósito quede explícito en el historial y en los flujos de agentes.",
    groupLabel: "Objetivo SEO principal",
  },
  baseline: {
    kicker: "Paso 5 de 7",
    title: "Construye la línea base",
    body: "Una auditoría completa da a las acciones evidencia a nivel de URL y crea un punto de referencia para la monitorización.",
    needsWebsiteTitle: "Este paso necesita un sitio web",
    needsWebsiteBefore:
      "Una auditoría base rastrea tu sitio. Añade un sitio web en",
    needsWebsiteLink: "Ajustes",
    needsWebsiteAfter:
      "para desbloquearla, o sáltatela — el resto de este espacio de trabajo funciona sin ella.",
    chooseGoalTitle: "Elige primero un objetivo",
    chooseGoalBody:
      "Selecciona el resultado de arriba antes de iniciar la línea base.",
    notStartedTitle: "La auditoría no pudo iniciarse",
    queuedTitle: "Auditoría en cola",
    queuedBody:
      "Sigue la ejecución desde el historial de auditorías. Las acciones se desbloquean solo cuando hay un resultado completado o parcial disponible.",
    privateAccessSummary: "Acceso a sitios privados",
    privateAccessLabel:
      "Permitir que este hostname exacto acceda a una red privada para esta auditoría",
    privateAccessHelp:
      "Solo {host}. Las direcciones de loopback y privadas siguen bloqueadas salvo que apruebes este host; los metadatos de la nube permanecen siempre bloqueados.",
    starting: "Iniciando auditoría…",
    run: "Ejecutar auditoría base",
    viewHistory: "Ver historial de auditorías",
  },
  firstMove: {
    kicker: "Paso 6 de 7",
    title: "Elige el primer movimiento",
    body: "Compara impacto, esfuerzo, confianza y evidencia de fuentes antes de comprometer recursos. Este paso se desbloquea solo cuando la línea base produce un resultado completado o parcial.",
    reviewActions: "Revisar acciones priorizadas",
    lockedReason: "Esperando una ejecución base completada.",
  },
  monitoring: {
    kicker: "Paso 7 de 7",
    title: "Activa la monitorización local",
    body: "Crea una auditoría semanal duradera a las 06:00 cada lunes en tu zona horaria local. Puedes cambiar la cadencia desde Monitorización.",
    notActivatedTitle: "La monitorización no se activó",
    activatedTitle: "Monitorización activada",
    activatedBody:
      "El servicio local en segundo plano ejecutará la programación semanal mientras esté disponible.",
    activeTitle: "La monitorización está activa",
    activeBody: "Al menos una programación activada protege esta propiedad.",
    activating: "Activando monitorización…",
    activate: "Activar monitorización semanal",
    manage: "Gestionar monitorización",
    lockedReason:
      "Completa la línea base y abre las acciones priorizadas antes de activar la monitorización.",
  },
} as const;
