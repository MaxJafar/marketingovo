/** The audits page: run launcher, private-site approval, crawl history. */
import type { MessagesFor } from "../types";

export const audits: MessagesFor<"audits"> = {
  eyebrow: "Historial de rastreo",
  title: "Auditorías",
  description:
    "Inicia una línea base, sigue los rastreos activos y compara instantáneas técnicas completadas.",
  starting: "Iniciando…",
  runFullAudit: "Ejecutar auditoría completa",
  privateAccess: {
    summary: "Acceso a sitios privados",
    allowTitle:
      "Permitir que este hostname exacto acceda a una red privada para esta auditoría",
    allowHelp:
      "Solo {host}. Esta aprobación aplica a las auditorías iniciadas desde esta página hasta que cambies de proyecto; los metadatos de la nube permanecen siempre bloqueados.",
  },
  scope: {
    summary: "Alcance experto de auditoría",
    title: "Auditar una cohorte exacta de URLs",
    body: "Pega una URL absoluta por línea. Marketingovo rastrea solo esta lista y conserva cada URL como semilla, lo cual es útil para migraciones, plantillas, muestras de QA y ejecuciones de verificación.",
    urlListLabel: "Lista de URLs",
    urlListHelp:
      "Las URLs deben usar el origen del proyecto. Los fragmentos y duplicados se eliminan antes de iniciar la ejecución.",
    errorTitle: "La cohorte de URLs necesita atención",
    submit: "Ejecutar auditoría de lista de URLs",
    atLeastOneUrl: "Añade al menos una URL absoluta.",
    invalidUrl: "URL no válida: {url}",
    unsupportedScheme: "Esquema de URL no compatible: {scheme}",
  },
  startErrorTitle: "La auditoría no pudo iniciarse",
  queuedTitle: "Auditoría en cola",
  queuedBody: "La API aceptó la ejecución. Actualiza o mira el estado abajo.",
  columns: {
    started: "Iniciada",
    status: "Estado",
    trigger: "Disparador",
    pagesCrawled: "Páginas rastreadas",
    issues: "Problemas",
    healthScore: "Puntuación de salud",
  },
  tableLabel: "Ejecuciones de auditoría",
  emptyTitle: "Aún no hay ejecuciones de auditoría",
  emptyBody:
    "Inicia una auditoría base completa para poblar el historial de rastreo y las acciones priorizadas.",
} as const;
