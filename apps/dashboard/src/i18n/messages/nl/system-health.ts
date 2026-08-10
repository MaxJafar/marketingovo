import type { MessagesFor } from "../types";

/** The local runtime page: overall status, uptime, and component checks. */
export const systemHealth: MessagesFor<"systemHealth"> = {
  eyebrow: "Lokale runtime",
  title: "Systeemgezondheid",
  description:
    "Verifieer de dashboard-API, opslag, workers en externe connectors voordat je een rapportagesnapshot vertrouwt.",
  overallStatus: "Algehele status",
  statusHealthy: "Alle gerapporteerde systemen operationeel",
  statusDegraded: "Sommige services hebben aandacht nodig",
  statusOffline: "Lokale API meldt een storing",
  statusUnknown: "Status is onbekend",
  version: "Versie",
  uptime: "Uptime",
  uptimeDaysHours: "{days}d {hours}u",
  uptimeHours: "{hours}u",
  checked: "Gecontroleerd",
  latency: "Latentie",
  latencyValue: "{value} ms",
  emptyTitle: "Geen componentchecks",
  emptyDescription:
    "De API gaf de algehele gezondheid terug, maar geen checks op componentniveau.",
} as const;
