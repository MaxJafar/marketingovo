import type { MessagesFor } from "../types";

/**
 * The cross-channel report: generation, stored snapshots, section panels,
 * charts, and coverage gaps. Conventions in shell.ts.
 */
export const marketingReport: MessagesFor<"marketingReport"> = {
  stateLabel: {
    available: "vollständig",
    partial: "teilweise Abdeckung",
    unavailable: "nicht gemessen",
    failed: "konnte nicht gelesen werden",
  },
  breakdownTitle: {
    paid: "Ausgaben nach Konto und Plattform",
    social: "Publizierte Beiträge nach Plattform",
    competitors: "Öffentliche Signale nach Wettbewerber",
  },
  changeVsPrevious: "{change} % ggü. Vorperiode",
  notMeasuredPeriod: "In diesem Zeitraum nicht gemessen.",
  compareHeading: "Dieser Zeitraum gegen den davor",
  fellToZero:
    "Fiel gegenüber der Vorperiode auf null; das Paar lässt sich aus den gespeicherten Zahlen nicht zeichnen.",
  notDrawn: "Nicht gezeichnet — {label}: {reason}",
  breakdownHeading: "Aufschlüsselung",
  notMeasuredCell: "nicht gemessen",
  sourcesPrefix: "Quellen:",
  sourceEntry: "{label} ({state}{reason})",
  noNarrative:
    "Noch keine Einordnung. Schreib eine, oder bitte einen angebundenen Agenten darum — eine aus den Zahlen zusammengesetzte Zusammenfassung liest sich wie Insight, ist aber Arithmetik, deshalb wird sie hier bewusst nicht generiert.",
  openClientVersion: "Kundenversion öffnen",
  plainText: "Nur Text",
  downloadPdf: "PDF herunterladen",
  gapsHeading: "Was dieser Bericht nicht sehen konnte",
  gapsBody:
    "Hier gesammelt und zusätzlich in jedem Abschnitt, damit auch ein Leser, der die Zahlen nur überfliegt, den Lücken begegnet.",
  generateHeading: "Bericht erzeugen",
  periodStart: "Zeitraumbeginn",
  periodEnd: "Zeitraumende",
  gathering: "Wird gesammelt…",
  generate: "Erzeugen",
  description:
    "Umfasst Paid, organische Suche, Social Publishing, E-Mail, das Wettbewerbsumfeld und erledigte Arbeit — mit Diagrammen für das Gemessene und einem herunterladbaren PDF. Lass die Daten leer für die letzten vollständigen 30 Tage — der aktuelle Tag ist ausgenommen, weil Anbieter ihn nachträglich korrigieren.",
  generateFailed: "Der Bericht konnte nicht erzeugt werden.",
  generatedOn: "· erzeugt {date}",
  empty:
    "Noch keine Berichte. Ein gespeicherter Bericht ist ein eingefrorener Snapshot — die Zahlen sind so, wie jede Plattform sie an dem Tag gemeldet hat, und werden nachträglich nicht korrigiert.",
} as const;
