/** The content calendar: entries, approvals, publish records, and media. */
import type { MessagesFor } from "../types";

export const contentCalendar: MessagesFor<"contentCalendar"> = {
  entry: {
    noTimeSet: "sin hora asignada",
    attachmentSingular: "{count} adjunto",
    attachmentPlural: "{count} adjuntos",
    sent: "Enviado {time}",
    openPost: "abrir la publicación",
    indeterminate:
      "Se envió una solicitud y no se registró respuesta, así que no se sabe si esta publicación salió. Comprueba {platform} antes de reintentar — Marketingovo no la reenviará por su cuenta.",
    refusedFallback: "El proveedor rechazó esta publicación.",
    needsTimeTitle: "Dale una hora a la publicación antes de aprobarla.",
    approve: "Aprobar para esta hora",
    sending: "Enviando…",
    sendNow: "Enviar ahora",
  },
  media: {
    title: "Medios",
    uploadLabel: "Subir medios",
    sizeKb: "{size}KB",
    publiclyReachable:
      "Accesible públicamente ({source}). Instagram puede obtenerlo.",
    storedLocally:
      "Guardado solo en esta máquina. Telegram, X y Facebook lo publican directamente; Instagram no puede, porque obtiene los medios desde una URL pública en lugar de aceptar una subida.",
    relayTitle:
      "Sube este archivo al almacenamiento de objetos que configuraste, para que Instagram pueda obtenerlo.",
    uploading: "Subiendo…",
    relay: "Publicar en mi almacenamiento",
    urlPlaceholder: "o pega una URL https:// pública que tú alojes",
    useUrl: "Usar esta URL",
    uploadRefused: "La subida fue rechazada.",
    empty:
      "Aún no hay medios. Los archivos que subas se quedan en esta máquina y se envían directamente a Telegram, X y Facebook cuando sale una publicación.",
  },
  overdue: {
    title: "Pasadas de hora y sin enviar",
    body: "Estas estaban programadas para un momento que ya pasó y nunca se aprobaron, así que no se envió nada. Un calendario que solo dibujara celdas las habría ocultado.",
  },
  week: {
    title: "Próximas dos semanas",
    loading: "Leyendo el calendario…",
    emptyBefore: "No hay nada programado. Redacta una publicación en",
    composerLink: "el compositor",
    emptyAfter:
      "o pide a un agente conectado que escriba una, y luego dale una hora aquí.",
  },
  unscheduled: {
    title: "Redactadas, esperando una hora",
    body: "Elige una hora y aprueba. Cambiar la hora de una publicación ya aprobada anula la aprobación, porque la hora es parte de lo que aprobaste.",
    timeLabel: "Hora programada",
    schedule: "Programar la publicación seleccionada",
    scheduleFailed: "La publicación no se pudo programar.",
  },
} as const;
