import type { MessagesFor } from "../types";

/** Social research: honest source status and where measured data lives. */
export const socialResearch: MessagesFor<"socialResearch"> = {
  status: {
    title: "Quellenstatus",
    connectedSingular:
      "{count} Social-Quelle fürs Publizieren verbunden. Listening — Erwähnungen, Sentiment, Engagement — hat noch keinen Collector, also wird nichts dergleichen gemessen oder angezeigt.",
    connectedPlural:
      "{count} Social-Quellen fürs Publizieren verbunden. Listening — Erwähnungen, Sentiment, Engagement — hat noch keinen Collector, also wird nichts dergleichen gemessen oder angezeigt.",
    none: "Keine Social-Quelle ist verbunden, und Social Listening hat noch keinen Collector — diese Seite zeigt daher gar keine Erwähnungs- oder Sentiment-Zahlen, statt sie zu erfinden.",
    connectLink: "Quelle verbinden",
  },
  measured: {
    title: "Was heute gemessen wird",
    body: "Publizieren wird lückenlos gemessen: Jeder im Kalender bereitgestellte Beitrag behält einen unveränderlichen Nachweis der exakten Anfrage an jede Plattform, und der kanalübergreifende Bericht zählt publizierte, abgelehnte und unbestimmte Sendungen pro Plattform.",
    openCalendar: "Kalender öffnen →",
    openReport: "Im Bericht ansehen →",
  },
  agent: {
    title: "Frag den Agenten",
    bodyBefore:
      "Social Listening ist noch kein Marketingovo-Collector. Ein angebundener Agent kann das trotzdem mit seinen eigenen Tools für dich recherchieren — frag ihn im Terminal unten, zum Beispiel",
    examplePrompt:
      "fasse zusammen, was diesen Monat auf Reddit über uns gesagt wurde",
    bodyAfter: ".",
  },
} as const;
