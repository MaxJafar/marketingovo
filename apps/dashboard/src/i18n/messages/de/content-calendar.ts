import type { MessagesFor } from "../types";

/** The content calendar: entries, approvals, publish records, and media. */
export const contentCalendar: MessagesFor<"contentCalendar"> = {
  entry: {
    noTimeSet: "keine Zeit gesetzt",
    attachmentSingular: "{count} Anhang",
    attachmentPlural: "{count} Anhänge",
    sent: "Gesendet {time}",
    openPost: "Beitrag öffnen",
    indeterminate:
      "Eine Anfrage wurde gesendet und keine Antwort aufgezeichnet — ob dieser Beitrag rausging, ist also unbekannt. Prüfe {platform}, bevor du es erneut versuchst — Marketingovo sendet nicht von allein noch einmal.",
    refusedFallback: "Der Anbieter hat diesen Beitrag abgelehnt.",
    needsTimeTitle: "Gib dem Beitrag eine Zeit, bevor du ihn freigibst.",
    approve: "Für diese Zeit freigeben",
    sending: "Wird gesendet…",
    sendNow: "Jetzt senden",
  },
  media: {
    title: "Medien",
    uploadLabel: "Medien hochladen",
    sizeKb: "{size} KB",
    publiclyReachable:
      "Öffentlich erreichbar ({source}). Instagram kann das abrufen.",
    storedLocally:
      "Nur auf diesem Rechner gespeichert. Telegram, X und Facebook posten es direkt; Instagram kann das nicht, weil es Medien von einer öffentlichen URL abruft, statt einen Upload anzunehmen.",
    relayTitle:
      "Lädt diese Datei in den von dir konfigurierten Objektspeicher hoch, damit Instagram sie abrufen kann.",
    uploading: "Wird hochgeladen…",
    relay: "In meinen Speicher publizieren",
    urlPlaceholder:
      "oder füge eine öffentliche https://-URL ein, die du hostest",
    useUrl: "Diese URL verwenden",
    uploadRefused: "Der Upload wurde abgelehnt.",
    empty:
      "Noch keine Medien. Hochgeladene Dateien bleiben auf diesem Rechner und werden direkt an Telegram, X und Facebook gesendet, wenn ein Beitrag rausgeht.",
  },
  overdue: {
    title: "Über der Zeit und ungesendet",
    body: "Diese waren für einen Moment geplant, der vorbei ist, und wurden nie freigegeben — gesendet wurde also nichts. Ein Kalender, der nur Zellen zeichnet, hätte sie versteckt.",
  },
  week: {
    title: "Nächste zwei Wochen",
    loading: "Kalender wird gelesen…",
    emptyBefore: "Nichts ist geplant. Entwirf einen Beitrag im",
    composerLink: "Composer",
    emptyAfter:
      "oder bitte einen angebundenen Agenten, einen zu schreiben, und gib ihm hier eine Zeit.",
  },
  unscheduled: {
    title: "Entworfen, wartet auf eine Zeit",
    body: "Wähle eine Zeit und gib frei. Wer die Zeit eines bereits freigegebenen Beitrags ändert, löscht die Freigabe — denn die Zeit ist Teil dessen, was du freigegeben hast.",
    timeLabel: "Geplante Zeit",
    schedule: "Ausgewählten Beitrag einplanen",
    scheduleFailed: "Der Beitrag konnte nicht eingeplant werden.",
  },
} as const;
