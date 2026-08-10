/**
 * Campaign links and their QR codes: the builder, the live preview, stored
 * links, and the self-hosted redirect config. Conventions in shell.ts.
 */
import type { MessagesFor } from "../types";

export const campaignLinks: MessagesFor<"campaignLinks"> = {
  verdictLabel: {
    comfortable: "escanea con fiabilidad",
    tight: "al límite",
    unscannable: "no escaneará",
  },
  placementOption: {
    screen: {
      label: "Pantalla",
      hint: "Diapositivas, una página web, un video",
    },
    printHandheld: {
      label: "En la mano",
      hint: "Folleto, tarjeta de visita, recibo",
    },
    printPoster: {
      label: "Cartel",
      hint: "Se lee a distancia, rara vez se toca",
    },
    packaging: { label: "Empaque", hint: "Curvo, rozado en el transporte" },
    outdoor: {
      label: "Exterior",
      hint: "Lluvia, sol, parcialmente obstruido",
    },
  },
  links: {
    heading: "Enlaces",
    qrAlt: "Código QR de {label}",
    printedTag: "impreso",
    copied: "Copiado",
    copyLink: "Copiar enlace",
    svg: "SVG",
    png: "PNG",
    markPrinted: "Marcar como impreso",
    delete: "Eliminar",
    noteOne: "{count} nota de cuando se creó",
    noteMany: "{count} notas de cuando se creó",
    empty:
      "Aún no hay enlaces. Los códigos creados aquí codifican su URL directamente, así que nada los resuelve y no pueden revocarse ni medirse.",
  },
  form: {
    heading: "Nuevo enlace de campaña",
    mark: "comprobado antes de que el código exista",
    intro:
      "Un código QR es una URL que se ha vuelto cara de cambiar. El etiquetado se comprueba aquí, mientras corregirlo aún no cuesta nada.",
    nameLabel: "Nombre",
    nameHelp: "Para encontrarlo después. Nunca aparece en la URL.",
    destinationLabel: "Destino",
    destinationHelp: "La página sin etiquetar. El etiquetado se añade abajo.",
    sourceLabel: "Fuente",
    sourceHelp: "De dónde vino",
    mediumLabel: "Medio",
    mediumHelp: "Cómo llegó",
    campaignLabel: "Campaña",
    campaignHelp: "Qué campaña",
    normalizedBefore: "Según la convención esto se convierte en",
    normalizedAfter: ".",
    useThat: "Usar eso",
    placementLabel: "¿Dónde estará este código?",
    placementHelp:
      "Decide el nivel de corrección de errores y el tamaño mínimo.",
    printedWidthLabel: "Ancho impreso (mm)",
    printedWidthHelp: "Cuán ancho será realmente en la pieza terminada.",
    coloursSummary: "Colores y margen",
    modulesLabel: "Módulos",
    backgroundLabel: "Fondo",
    quietZoneLabel: "Zona de silencio",
    quietZoneHelp: "Cuatro es el mínimo estándar.",
  },
  preview: {
    heading: "Previsualización",
    moduleSize: "Tamaño de módulo",
    readableFrom: "Legible desde",
    readableUpTo: "hasta {distance}cm",
    contrast: "Contraste",
    symbol: "Símbolo",
    symbolSpec: "versión {version}, {count}×{count} módulos, nivel {level}",
    blockingHeading: "Esto impide guardar",
    blockingBody:
      "Todo lo demás en este producto registra el problema y sigue adelante. Esto no, porque un código impreso no tiene segundo intento.",
    advisoryHeading: "Vale la pena saber",
    saveFailed: "El enlace no se pudo guardar.",
    saving: "Guardando…",
    saveLink: "Guardar este enlace",
    nameFirst: "Dale un nombre primero.",
  },
  redirect: {
    heading: "Códigos que puedes reapuntar después",
    body: "Un código QR no puede caducar ni cambiar — los módulos codifican el destino. Los productos que venden códigos “dinámicos” venden una redirección en su propio dominio, que es también la razón por la que pueden dejar de resolverla. Pon la redirección en un dominio que ya poseas y la misma capacidad no cuesta nada y no responde ante nadie.",
    platformLabel: "Plataforma",
    cannotExpire: "no puede caducar por sí solo",
    shortDomainLabel: "Tu dominio corto",
    endsOnLabel: "Termina el",
    expiryNote:
      "{platform} no puede comprobar una fecha. La caducidad queda escrita como comentario y algo tiene que editar el archivo.",
    building: "Construyendo…",
    buildConfig: "Construir la config",
    copy: "Copiar",
  },
} as const;
