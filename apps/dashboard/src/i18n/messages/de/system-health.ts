import type { MessagesFor } from "../types";

/** The local runtime page: overall status, uptime, and component checks. */
export const systemHealth: MessagesFor<"systemHealth"> = {
  eyebrow: "Lokale Laufzeitumgebung",
  title: "Systemzustand",
  description:
    "Verifiziere Dashboard-API, Speicher, Worker und externe Konnektoren, bevor du einem Reporting-Snapshot vertraust.",
  overallStatus: "Gesamtstatus",
  statusHealthy: "Alle gemeldeten Systeme betriebsbereit",
  statusDegraded: "Einige Dienste brauchen Aufmerksamkeit",
  statusOffline: "Lokale API meldet einen Ausfall",
  statusUnknown: "Status ist unbekannt",
  version: "Version",
  uptime: "Laufzeit",
  uptimeDaysHours: "{days} T {hours} Std.",
  uptimeHours: "{hours} Std.",
  checked: "Geprüft",
  latency: "Latenz",
  latencyValue: "{value} ms",
  emptyTitle: "Keine Komponentenprüfungen",
  emptyDescription:
    "Die API hat den Gesamtzustand, aber keine Prüfungen auf Komponentenebene zurückgegeben.",
} as const;
