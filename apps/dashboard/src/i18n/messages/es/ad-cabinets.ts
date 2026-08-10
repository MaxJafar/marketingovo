/**
 * Ad Cabinets — connections, linked cabinets, stored performance, wasted
 * queries, and the spend-approval queue. Conventions in shell.ts.
 */
import type { MessagesFor } from "../types";

export const adCabinets: MessagesFor<"adCabinets"> = {
  platformLabel: {
    all: "Todas las ubicaciones",
    facebook: "Facebook",
    instagram: "Instagram",
    messenger: "Messenger",
    audience_network: "Audience Network",
    google_search: "Búsqueda de Google",
    google_search_partners: "Socios de búsqueda",
    google_display: "Google Display",
    google_youtube: "YouTube",
    google_performance_max: "Performance Max",
    unknown: "Otra ubicación",
  },
  metricLabel: {
    spend: "Inversión",
    impressions: "Impresiones",
    clicks: "Clics",
    link_clicks: "Clics en enlaces",
    conversions: "Conversiones",
    conversion_value: "Valor de conversión",
    cost_per_conversion: "Costo por conversión",
    ctr: "CTR",
    cpc: "CPC",
    cpm: "CPM",
    reach: "Alcance",
    frequency: "Frecuencia",
    video_plays: "Reproducciones de video",
  },
  state: {
    partial: "parcial — {observed}/{requested} días",
    failed: "no se pudo leer",
    unavailable: "sin medir",
  },
  performance: {
    loading: "Leyendo las mediciones guardadas…",
    unreadable: "Las mediciones de esta cuenta no se pudieron leer.",
    neverSynced:
      "Nunca sincronizada. Ejecuta una auditoría de pago para leer la inversión y la entrega de esta cuenta. No se muestra nada hasta que algo se mide.",
    syncedRange: "De {start} a {end}. Última sincronización {date}.",
    metricHeader: "Métrica",
    valueHeader: "Valor",
    coverageHeader: "Cobertura",
    coverageComplete: "completa",
    metricNote: "{metric}: {note}",
  },
  wasted: {
    heading: "Consultas que merecen una decisión",
    loading: "Leyendo los términos de búsqueda guardados…",
    empty:
      "Aún no hay términos de búsqueda guardados para esta cuenta. Ejecuta una auditoría de pago.",
    queryHeader: "Consulta",
    matchedHeader: "Concordancia",
    clicksHeader: "Clics",
    costHeader: "Costo",
    conversionsHeader: "Conversiones",
    footnote:
      "Solo Búsqueda y Shopping. Performance Max y Demand Gen no reportan consultas en absoluto, y Google retiene los términos demasiado raros para anonimizar, así que esto nunca da cuenta de todos los clics de una cuenta. Una lista corta no es evidencia de que no se esté desperdiciando nada.",
  },
  queue: {
    heading: "Esperando tu aprobación",
    empty:
      "Nada está esperando aprobación. Un agente conectado puede redactar una campaña y prepararla aquí; no puede aprobarla, y este producto tampoco puede enviar nada a una plataforma publicitaria todavía. Google Ads es de solo lectura por diseño — mira el ADR 0008.",
    perDay: "{amount} al día",
    lifetime: "{amount} en total",
    noBudget: "Sin presupuesto indicado",
    stagedOne:
      "{count} payload preparado. Lee la solicitud exacta antes de aprobar — la aprobación se vincula a esta versión, y un payload editado después tiene que aprobarse de nuevo.",
    stagedMany:
      "{count} payloads preparados. Lee la solicitud exacta antes de aprobar — la aprobación se vincula a esta versión, y un payload editado después tiene que aprobarse de nuevo.",
    stagedBy: "Preparado por {name} el {date}. Payload {hash}…",
    hidePayload: "Ocultar payload",
    readPayload: "Leer payload",
    readBeforeApproving: "Lee el payload antes de aprobarlo.",
    approveExact: "Aprobar este payload exacto",
    withdraw: "Retirar",
    approvalRefused: "La aprobación fue rechazada.",
    footnote:
      "Aprobar registra tu consentimiento a este payload exacto. No envía nada: esta versión no tiene ruta de escritura hacia Meta, por diseño.",
  },
  connections: {
    heading: "Conexiones",
    integrationsLink: "Integraciones",
    metaExpiredBefore:
      "El token de acceso de Meta caducó. Los tokens de usuario del sistema de Meta tienen una vida fija y no se renuevan — genera uno nuevo en Business Manager y pégalo en",
    metaExpiredAfter:
      ". Hasta entonces, la inversión y la entrega son ilegibles, no cero.",
    metaConnectedExpiry:
      "Meta está conectado. El token caduca {date} — rótalo antes.",
    metaConnected: "Meta está conectado.",
    metaMissingBefore:
      "Meta no está conectado, así que la inversión de Facebook e Instagram no se puede leer. Genera un token de usuario del sistema en Meta Business Manager y pégalo en",
    metaMissingAfter: ".",
    googleExpiredBefore:
      "El inicio de sesión de Google para Google Ads caducó. Reconéctalo en",
    googleExpiredAfter:
      ". Hasta entonces, la inversión de Google es ilegible, no cero.",
    googleConnected: "Google Ads está conectado.",
    googleMissingBefore:
      "Google Ads no está conectado. Necesita dos cosas: un inicio de sesión de Google y un token de desarrollador propio del API Center de una cuenta de administrador de Google Ads. Marketingovo no incluye ningún token de desarrollador — uno compilado en la app convertiría cada instalación en una sola identidad ante Google, y sus límites de uso y condiciones recaen en quien lo posee. Google aprueba los tokens nuevos a mano, así que solicítalo antes de necesitarlo. Ambos van en",
    googleMissingAfter: ".",
  },
  cabinets: {
    heading: "Cuentas publicitarias",
    providerSelectLabel: "Proveedor en el que buscar cuentas",
    asking: "Consultando a {provider}…",
    findAccounts: "Buscar mis cuentas",
    starting: "Iniciando…",
    runPaidAudit: "Ejecutar auditoría de pago",
    auditCheckBefore:
      "La auditoría de pago también revisa las páginas a las que estos anuncios envían a la gente — destinos que dan 404, redirecciones que pierden el identificador de clic y páginas de destino que nunca mencionan aquello por lo que se puja. Los hallazgos aparecen en",
    actionsLink: "Acciones",
    auditCheckAfter:
      ". Ejecutar antes una auditoría SEO abarata la comprobación y le añade velocidad de página; sin ella, cada destino se obtiene directamente.",
    empty:
      "Ninguna cuenta publicitaria está vinculada a este espacio de trabajo. Un mismo inicio de sesión suele alcanzar varias cuentas, y cuáles de ellas lee este espacio es decisión tuya — conectar un proveedor no vincula nada por sí solo.",
    billsIn: "factura en {currency}",
    noCurrency: "esta cuenta no reporta moneda",
    dailyCap: "tope diario {cap}",
    noDailyCap: "sin tope diario local definido",
    hidePerformance: "Ocultar rendimiento",
    showPerformance: "Mostrar rendimiento",
    archive: "Archivar",
    remove: "Eliminar",
    removeTitle:
      "Elimina la cuenta y todas las mediciones registradas contra ella.",
    discoveryFailed:
      "No se pudo contactar con {provider} para descubrir cuentas.",
    discoveredHeading: "Cuentas que esta credencial puede alcanzar",
    linked: "Vinculada",
    linkToWorkspace: "Vincular a este espacio de trabajo",
  },
} as const;
