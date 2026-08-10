import type { MessagesFor } from "../types";

/** The reports library: exportable snapshots and their download formats. */
export const reports: MessagesFor<"reports"> = {
  eyebrow: "Resultaten delen",
  title: "Rapporten",
  description:
    "Houd stakeholders op één lijn met exporteerbare snapshots en geplande prestatiesamenvattingen.",
  typeFallback: "SEO-rapport",
  generated: "Gegenereerd {date}",
  scheduledFor: "Gepland voor {date}",
  scheduleUnavailable: "Planning niet beschikbaar",
  recipients: "Ontvangers: {list}",
  downloadGroupLabel: "{name} downloaden",
  downloadFormatLabel: "{format}-rapport downloaden: {name}",
  downloadUnavailable: "Download niet beschikbaar",
  emptyTitle: "Nog geen rapporten",
  emptyDescription:
    "Genereer rapporten via de API of stel een planning in zodra je basisdata beschikbaar is.",
} as const;
