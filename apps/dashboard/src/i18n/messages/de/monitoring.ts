import type { MessagesFor } from "../types";

/** Monitoring page: the schedule editor, schedule list, and alert stream. */
export const monitoring: MessagesFor<"monitoring"> = {
  eyebrow: "Dauerhafte Absicherung",
  title: "Monitoring",
  description:
    "Plane lokale Audits und mache Regressionen sichtbar, bevor sie zu Reporting-Überraschungen werden. Zeitpläne laufen, solange der Marketingovo-Hintergrunddienst aktiv ist.",
  mutationErrorTitle: "Zeitplanänderung fehlgeschlagen",
  editor: {
    editTitle: "Zeitplan bearbeiten",
    createTitle: "Zeitplan erstellen",
    intro:
      "Starte ein Site-Audit oder erzeuge den kanalübergreifenden Bericht in einem marketerfreundlichen Rhythmus, oder nutze einen üblichen Fünf-Feld-Cron-Ausdruck.",
    cancelEdit: "Bearbeitung abbrechen",
    workflowLabel: "Was ausgeführt wird",
    workflowAudit: "Site-Audit",
    workflowReport: "Kanalübergreifender Bericht",
    workflowAsCreated: "{workflow} (wie erstellt)",
    frequencyLabel: "Häufigkeit",
    frequencyDaily: "Täglich",
    frequencyWeekly: "Wöchentlich",
    frequencyMonthly: "Monatlich (am 1.)",
    frequencyCustom: "Eigener Cron",
    cronLabel: "Cron-Ausdruck",
    timeLabel: "Lokale Zeit",
    dayLabel: "Tag",
    timezoneLabel: "Zeitzone",
    reportNoticeTitle: "Berichte zitieren Audits",
    reportNoticeBody:
      "Ein Bericht zitiert nur ein Audit, das innerhalb seines eigenen Zeitraums gelaufen ist. Kombiniere einen Berichts-Zeitplan mit einem Audit-Zeitplan, sonst meldet sein Organik-Abschnitt, es sei nicht gemessen worden.",
    saving: "Wird gespeichert…",
    save: "Zeitplan speichern",
    create: "Zeitplan erstellen",
  },
  weekdays: {
    monday: "Montag",
    tuesday: "Dienstag",
    wednesday: "Mittwoch",
    thursday: "Donnerstag",
    friday: "Freitag",
    saturday: "Samstag",
    sunday: "Sonntag",
  },
  cadenceMonthly: "Monatlich am 1. um {time}",
  cadenceDaily: "Täglich um {time}",
  cadenceWeekly: "Jeden {weekday} um {time}",
  cadenceDayFallback: "Tag {day}",
  schedules: {
    title: "Zeitpläne",
    description: "Dauerhafte Audit-Zeitpläne für dieses Projekt.",
    pauseAria: "Zeitplan {name} pausieren",
    enableAria: "Zeitplan {name} aktivieren",
    timezoneUnavailable: "Zeitzone nicht verfügbar",
    nextRun: "Nächster: {date}",
    edit: "Bearbeiten",
    delete: "Löschen",
    deleteConfirm: "Den Zeitplan {name} löschen?",
    emptyTitle: "Keine Zeitpläne",
    emptyDescription:
      "Erstelle oben einen Zeitplan, um wiederholte Audits laufen zu lassen, solange der Hintergrunddienst aktiv ist.",
  },
  alerts: {
    title: "Aktuelle Alerts",
    description: "Offene und bestätigte Änderungen, die ein Review brauchen.",
    noDetail: "Es wurden keine weiteren Details zurückgegeben.",
    status: "Status: {status}",
    emptyTitle: "Keine Monitoring-Alerts",
    emptyDescription:
      "Ein gültiger leerer Alert-Stream bedeutet, dass keine Alerts zurückgegeben wurden — nicht, dass jede Quelle gesund ist.",
  },
} as const;
