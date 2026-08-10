/** Workspace setup wizard: five linear steps from empty install to first runs. */
import type { MessagesFor } from "../types";

export const wizard: MessagesFor<"wizard"> = {
  eyebrow: "Configuración",
  title: "Crea tu espacio de trabajo de marketing",
  description:
    "Cinco pasos hasta un panel con datos reales. Solo se requiere el nombre de la marca.",
  progressLabel: "Progreso de la configuración",
  optional: "Opcional",
  errorTitle: "Ese paso no se pudo guardar",
  genericError: "Algo salió mal.",
  launchError: "No se pudieron iniciar las ejecuciones.",
  back: "Atrás",
  continue: "Continuar",
  saving: "Guardando…",
  starting: "Iniciando…",
  startRuns: "Iniciar las primeras ejecuciones",
  goToDashboard: "Ir al panel",
  steps: {
    workspace: { label: "Espacio de trabajo", hint: "Nombra la marca." },
    brand: {
      label: "Presencia de marca",
      hint: "Dónde más vive la marca.",
    },
    competitors: {
      label: "Competidores",
      hint: "Contra quién medirse.",
    },
    data: { label: "Fuentes de datos", hint: "Opcional. Se puede omitir." },
    launch: { label: "Revisión", hint: "Inicia las primeras ejecuciones." },
  },
  providers: {
    googleSearchConsole: {
      label: "Google Search Console",
      why: "Ordena los hallazgos según las consultas y páginas que realmente ganan impresiones.",
      field: "URL de la propiedad o identificador sc-domain",
    },
    googleAnalytics4: {
      label: "Google Analytics 4",
      why: "Pondera los hallazgos por sesiones y conversiones en lugar de solo por severidad.",
      field: "ID de la propiedad",
    },
    pagespeedInsights: {
      label: "PageSpeed Insights",
      why: "Añade Core Web Vitals de campo a la auditoría técnica.",
      field: "Clave de API",
    },
    serpapi: {
      label: "SerpAPI",
      why: "Requerido para el seguimiento de posiciones en vivo. Sin él, las posiciones quedan sin medir.",
      field: "Clave de API",
    },
  },
  runs: {
    baselineAudit: "Auditoría base",
    competitorComparison: "Comparación de competidores",
    osintDossier: "Dossier OSINT de web pública",
  },
  workspace: {
    title: "¿Qué vamos a seguir?",
    description:
      "El espacio de trabajo lleva el nombre de la marca. Añade un sitio web solo si quieres que se rastree.",
    brandName: "Nombre de la marca",
    website: "Sitio web",
    websiteHelp:
      "Necesario solo para el rastreo y las auditorías SEO. Social, anuncios e investigación funcionan sin él, y puedes añadir uno más adelante desde Ajustes. Se añade https:// si lo omites.",
    summaryLabel: "¿Qué hace esta marca?",
    summaryHelp:
      "Se registra como contexto del espacio de trabajo para que informes y agentes compartan el mismo trasfondo.",
  },
  brand: {
    title: "¿Dónde más vive la marca?",
    description:
      "Cada perfil se contrasta con tu rastreo: si alguna página enlaza a él, y si está declarado en el sameAs de schema.org. Un perfil sin enlaces es invisible para los buscadores.",
    label: "Etiqueta",
    profileUrl: "URL del perfil",
    removeProfile: "Eliminar perfil {number}",
    remove: "Eliminar",
    addProfile: "Añadir otro perfil",
  },
  competitors: {
    title: "¿Contra quién te miden?",
    description:
      "Cada competidor se rastrea con los mismos límites que tu propio sitio. La cadencia de publicación y las brechas de contenido salen de sus páginas, así que no hace falta clave de proveedor.",
    domains: "Dominios de competidores",
    domainsHelp:
      "Uno por línea. Los dos primeros se comparan en la ejecución inicial; el resto se conserva en el contexto del espacio de trabajo.",
  },
  data: {
    title: "Conecta tus datos",
    description:
      "Todos estos son opcionales. Omítelos y la auditoría se ejecuta igual — los hallazgos se ordenan por severidad técnica y alcance, y todo lo que necesite una fuente se reporta como no disponible en lugar de adivinarse.",
    storageTitle: "Dónde se guardan",
    storageBody:
      "Las credenciales van al almacén de credenciales local de esta máquina y nunca se escriben en informes, registros ni artefactos.",
  },
  launch: {
    title: "Listo para ejecutar",
    description:
      "La auditoría base, la comparación de competidores y la pasada OSINT de web pública opcional se ponen en cola juntas.",
    brand: "Marca",
    unnamed: "Sin nombre",
    website: "Sitio web",
    notSet: "Sin definir",
    brandProfiles: "Perfiles de marca",
    noProfiles: "Ninguno — la presencia de marca no se comprobará",
    competitors: "Competidores",
    noCompetitors: "Ninguno — la inteligencia de mercado queda vacía",
    dataSources: "Fuentes de datos",
    providersConfigured: "{count} configuradas",
    noProviders:
      "Ninguna — los hallazgos se ordenan solo por severidad y alcance",
    osint: "OSINT de web pública",
    osintIncluded:
      "Incluido — señales públicas citadas e historial de pasadas repetidas",
    osintSkippedPrivate: "Omitido — se requiere un objetivo público",
    osintSkippedChoice: "Omitido por elección",
    integrationsDetected: "Integraciones detectadas",
    integrationsAvailable: "{count} disponibles",
    checking: "Comprobando…",
    osintLabel: "Incluir el dossier OSINT de web pública",
    osintHelp:
      "Recomendado. Usa solo este sitio y las URLs de competidores explícitas de arriba, con enlaces a fuentes, estados de disponibilidad y sin búsqueda de personas, scraping autenticado ni recolección en la dark web. Las URLs de competidores privadas o de loopback se excluyen.",
    osintOff:
      "OSINT queda desactivado para {host}; se limita a objetivos públicos. La línea base aún puede ejecutarse con la autorización de host privado de arriba.",
    privateTitle: "Esta ejecución apunta a una dirección privada",
    privateBodyOne:
      "{hosts} está en una red privada o de loopback. El rastreador los rechaza salvo que los autorices para este espacio de trabajo.",
    privateBodyMany:
      "{hosts} están en una red privada o de loopback. El rastreador los rechaza salvo que los autorices para este espacio de trabajo.",
    allowOne:
      "Permitir rastrear este host. Solo estos hosts exactos quedan autorizados; el resto de la red privada sigue bloqueado.",
    allowMany:
      "Permitir rastrear estos hosts. Solo estos hosts exactos quedan autorizados; el resto de la red privada sigue bloqueado.",
    startedTitle: "Ejecuciones iniciadas",
    queuedJoiner: " y ",
    queued:
      "{runs} en cola. El progreso es visible en Auditorías; este espacio de trabajo se irá llenando conforme cada ejecución termine.",
  },
} as const;
