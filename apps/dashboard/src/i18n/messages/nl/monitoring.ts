import type { MessagesFor } from "../types";

/** Monitoring page: the schedule editor, schedule list, and alert stream. */
export const monitoring: MessagesFor<"monitoring"> = {
  eyebrow: "Altijd-aan zekerheid",
  title: "Monitoring",
  description:
    "Plan lokale audits en breng regressies aan het licht voordat ze rapportageverrassingen worden. Schema's draaien zolang de Marketingovo-achtergrondservice actief is.",
  mutationErrorTitle: "Schemawijziging mislukt",
  editor: {
    editTitle: "Schema bewerken",
    createTitle: "Schema aanmaken",
    intro:
      "Draai een site-audit of genereer het cross-channelrapport op een marketeersvriendelijk ritme, of gebruik een standaard cron-expressie met vijf velden.",
    cancelEdit: "Bewerken annuleren",
    workflowLabel: "Wat te draaien",
    workflowAudit: "Site-audit",
    workflowReport: "Cross-channelrapport",
    workflowAsCreated: "{workflow} (zoals aangemaakt)",
    frequencyLabel: "Frequentie",
    frequencyDaily: "Dagelijks",
    frequencyWeekly: "Wekelijks",
    frequencyMonthly: "Maandelijks (de 1e)",
    frequencyCustom: "Aangepaste cron",
    cronLabel: "Cron-expressie",
    timeLabel: "Lokale tijd",
    dayLabel: "Dag",
    timezoneLabel: "Tijdzone",
    reportNoticeTitle: "Rapporten citeren audits",
    reportNoticeBody:
      "Een rapport citeert alleen een audit die binnen zijn eigen periode draaide. Koppel een rapportschema aan een auditschema, anders meldt de organische sectie dat er niet is gemeten.",
    saving: "Opslaan…",
    save: "Schema opslaan",
    create: "Schema aanmaken",
  },
  weekdays: {
    monday: "maandag",
    tuesday: "dinsdag",
    wednesday: "woensdag",
    thursday: "donderdag",
    friday: "vrijdag",
    saturday: "zaterdag",
    sunday: "zondag",
  },
  cadenceMonthly: "Maandelijks op de 1e om {time}",
  cadenceDaily: "Dagelijks om {time}",
  cadenceWeekly: "Elke {weekday} om {time}",
  cadenceDayFallback: "dag {day}",
  schedules: {
    title: "Schema's",
    description: "Duurzame auditschema's voor dit project.",
    pauseAria: "Schema {name} pauzeren",
    enableAria: "Schema {name} inschakelen",
    timezoneUnavailable: "Tijdzone niet beschikbaar",
    nextRun: "Volgende: {date}",
    edit: "Bewerken",
    delete: "Verwijderen",
    deleteConfirm: "Het schema {name} verwijderen?",
    emptyTitle: "Geen schema's",
    emptyDescription:
      "Maak hierboven een schema aan om herhaalaudits te draaien zolang de achtergrondservice actief is.",
  },
  alerts: {
    title: "Recente alerts",
    description: "Open en bevestigde veranderingen die review nodig hebben.",
    noDetail: "Er is geen aanvullend detail teruggegeven.",
    status: "Status: {status}",
    emptyTitle: "Geen monitoringalerts",
    emptyDescription:
      "Een geldige lege alertstream betekent dat er geen alerts zijn teruggegeven — niet dat elke bron gezond is.",
  },
} as const;
