/** The local runtime page: overall status, uptime, and component checks. */
import type { MessagesFor } from "../types";

export const systemHealth: MessagesFor<"systemHealth"> = {
  eyebrow: "Runtime local",
  title: "Salud del sistema",
  description:
    "Verifica la API del panel, el almacenamiento, los workers y los conectores externos antes de confiar en una instantánea de informes.",
  overallStatus: "Estado general",
  statusHealthy: "Todos los sistemas reportados operativos",
  statusDegraded: "Algunos servicios necesitan atención",
  statusOffline: "La API local reporta una interrupción",
  statusUnknown: "El estado es desconocido",
  version: "Versión",
  uptime: "Tiempo activo",
  uptimeDaysHours: "{days}d {hours}h",
  uptimeHours: "{hours}h",
  checked: "Comprobado",
  latency: "Latencia",
  latencyValue: "{value} ms",
  emptyTitle: "Sin comprobaciones de componentes",
  emptyDescription:
    "La API devolvió la salud general pero ninguna comprobación por componente.",
} as const;
