/**
 * The cross-channel report: generation, stored snapshots, section panels,
 * charts, and coverage gaps. Conventions in shell.ts.
 */
import type { MessagesFor } from "../types";

export const marketingReport: MessagesFor<"marketingReport"> = {
  stateLabel: {
    available: "completo",
    partial: "cobertura parcial",
    unavailable: "sin medir",
    failed: "no se pudo leer",
  },
  breakdownTitle: {
    paid: "Inversión por cuenta y plataforma",
    social: "Publicaciones realizadas por plataforma",
    competitors: "Señales públicas por competidor",
  },
  changeVsPrevious: "{change}% vs periodo anterior",
  notMeasuredPeriod: "No medido en este periodo.",
  compareHeading: "Este periodo contra el anterior",
  fellToZero:
    "Cayó a cero respecto al periodo anterior; el par no puede dibujarse a partir de las cifras guardadas.",
  notDrawn: "No dibujado — {label}: {reason}",
  breakdownHeading: "Desglose",
  notMeasuredCell: "sin medir",
  sourcesPrefix: "Fuentes:",
  sourceEntry: "{label} ({state}{reason})",
  noNarrative:
    "Aún no hay narrativa. Escribe una, o pídeselo a un agente conectado — un resumen ensamblado a partir de los números parece un insight siendo aritmética, así que deliberadamente no se genera.",
  openClientVersion: "Abrir la versión para el cliente",
  plainText: "Texto plano",
  downloadPdf: "Descargar PDF",
  gapsHeading: "Lo que este informe no pudo ver",
  gapsBody:
    "Reunido aquí además de en cada sección, para que quien hojee los números también se encuentre con las carencias.",
  generateHeading: "Generar un informe",
  periodStart: "Inicio del periodo",
  periodEnd: "Fin del periodo",
  gathering: "Recopilando…",
  generate: "Generar",
  description:
    "Abarca pago, búsqueda orgánica, publicación social, email, el panorama competitivo y el trabajo completado — con gráficas de lo medido y un PDF descargable. Deja las fechas vacías para los últimos 30 días completos — el día en curso se excluye porque los proveedores lo reformulan.",
  generateFailed: "El informe no se pudo generar.",
  generatedOn: "· generado {date}",
  empty:
    "Aún no hay informes. Un informe guardado es una instantánea congelada — las cifras son las que cada plataforma reportó ese día, y no se reformulan después.",
} as const;
