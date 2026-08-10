import type { MessagesFor } from "../types";

/** The reports library: exportable snapshots and their download formats. */
export const reports: MessagesFor<"reports"> = {
  eyebrow: "Ergebnisse teilen",
  title: "Berichte",
  description:
    "Halte Stakeholder mit exportierbaren Snapshots und geplanten Performance-Zusammenfassungen auf einer Linie.",
  typeFallback: "SEO-Bericht",
  generated: "Erzeugt {date}",
  scheduledFor: "Geplant für {date}",
  scheduleUnavailable: "Zeitplan nicht verfügbar",
  recipients: "Empfänger: {list}",
  downloadGroupLabel: "{name} herunterladen",
  downloadFormatLabel: "{format}-Bericht herunterladen: {name}",
  downloadUnavailable: "Download nicht verfügbar",
  emptyTitle: "Noch keine Berichte",
  emptyDescription:
    "Erzeuge Berichte über die API oder richte einen Zeitplan ein, sobald deine Baseline-Daten verfügbar sind.",
} as const;
