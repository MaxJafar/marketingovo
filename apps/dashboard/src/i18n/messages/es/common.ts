/** Shared primitives: formatters, query states, capability gates, freshness. */
import type { MessagesFor } from "../types";

export const common: MessagesFor<"common"> = {
  unavailable: "No disponible",
  noComparison: "No hay comparación disponible",
  vsPriorPeriod: "{change}% vs periodo anterior",
  createWorkspaceTitle: "Crea un espacio de trabajo para empezar",
  createWorkspaceBody:
    "Un espacio de trabajo reúne tus canales, investigación y notas. Crea uno para empezar — puedes añadir un sitio web después, o nunca.",
  loadingLabel: "Cargando datos",
  errorTitle: "Los datos no están disponibles",
  errorFallback: "La API no devolvió este espacio de trabajo.",
  errorHint:
    "Ningún valor se ha sustituido por cero. Revisa la API local y el estado de las integraciones.",
  tryAgain: "Reintentar",
  gateTitle: "Esto necesita una cosa más",
  gateHint:
    "Todo lo demás en este espacio de trabajo sigue funcionando. Nada aquí se ha rellenado con un valor ficticio.",
  freshness: {
    stale:
      "Esta vista usa la última instantánea disponible. Puede que no incluya cambios recientes.",
    missing: "Una o más fuentes no han proporcionado datos para esta vista.",
    unavailable: "No se pudo contactar con una o más fuentes.",
    unknown:
      "La API no proporcionó una garantía de frescura para esta respuesta.",
    fresh: "La respuesta incluye advertencias de las fuentes.",
  },
  snapshot: "Instantánea: {time}",
  invalidSessionResponse:
    "El servicio local devolvió una respuesta de sesión no válida.",
  importTooLarge: "El archivo .marketingovo debe pesar 25 MiB o menos.",
  importWrongExtension: "Elige un archivo con la extensión .marketingovo.",
  serviceUnreachable: "No se puede contactar con el servicio local.",
  messageNotSent: "Ese mensaje no se envió.",
  trendUnavailable: "Tendencia no disponible",
  trendEmptyBody:
    "Se necesitan al menos dos mediciones con fecha para dibujar una tendencia fiable.",
  historicalSignal: "Señal histórica",
  observations: "{count} observaciones",
  trendRange: "{title}, de {min} a {max}",
} as const;
