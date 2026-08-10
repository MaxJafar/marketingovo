/** The reports library: exportable snapshots and their download formats. */
import type { MessagesFor } from "../types";

export const reports: MessagesFor<"reports"> = {
  eyebrow: "Comparte resultados",
  title: "Informes",
  description:
    "Mantén alineados a los interesados con instantáneas exportables y resúmenes de rendimiento programados.",
  typeFallback: "Informe SEO",
  generated: "Generado {date}",
  scheduledFor: "Programado para {date}",
  scheduleUnavailable: "Programación no disponible",
  recipients: "Destinatarios: {list}",
  downloadGroupLabel: "Descargar {name}",
  downloadFormatLabel: "Descargar informe {format}: {name}",
  downloadUnavailable: "Descarga no disponible",
  emptyTitle: "Aún no hay informes",
  emptyDescription:
    "Genera informes a través de la API o configura una programación cuando tus datos base estén disponibles.",
} as const;
