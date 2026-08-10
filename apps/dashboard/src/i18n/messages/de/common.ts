import type { MessagesFor } from "../types";

/** Shared primitives: formatters, query states, capability gates, freshness. */
export const common: MessagesFor<"common"> = {
  unavailable: "Nicht verfügbar",
  noComparison: "Kein Vergleich verfügbar",
  vsPriorPeriod: "{change} % ggü. Vorperiode",
  createWorkspaceTitle: "Lege zum Start einen Workspace an",
  createWorkspaceBody:
    "Ein Workspace hält deine Kanäle, Recherchen und Notizen. Lege einen an, um loszulegen — eine Website kannst du später hinzufügen, oder nie.",
  loadingLabel: "Daten werden geladen",
  errorTitle: "Daten sind nicht verfügbar",
  errorFallback: "Die API hat diesen Workspace nicht zurückgegeben.",
  errorHint:
    "Kein Wert wurde durch null ersetzt. Prüfe die lokale API und den Zustand der Integrationen.",
  tryAgain: "Erneut versuchen",
  gateTitle: "Hier fehlt noch eine Sache",
  gateHint:
    "Alles andere in diesem Workspace läuft weiter. Nichts hier wurde mit einem Platzhalter aufgefüllt.",
  freshness: {
    stale:
      "Diese Ansicht nutzt den neuesten verfügbaren Snapshot. Jüngste Änderungen sind eventuell nicht enthalten.",
    missing:
      "Eine oder mehrere Quellen haben für diese Ansicht keine Daten geliefert.",
    unavailable: "Eine oder mehrere Quellen waren nicht erreichbar.",
    unknown:
      "Die API hat für diese Antwort keine Aktualitätsgarantie geliefert.",
    fresh: "Die Antwort enthält Quellen-Warnungen.",
  },
  snapshot: "Snapshot: {time}",
  invalidSessionResponse:
    "Der lokale Dienst hat eine ungültige Sitzungsantwort zurückgegeben.",
  importTooLarge: "Die .marketingovo-Datei darf höchstens 25 MiB groß sein.",
  importWrongExtension: "Wähle eine Datei mit der Endung .marketingovo.",
  serviceUnreachable: "Der lokale Dienst ist nicht erreichbar.",
  messageNotSent: "Diese Nachricht wurde nicht gesendet.",
  trendUnavailable: "Trend nicht verfügbar",
  trendEmptyBody:
    "Mindestens zwei datierte Messungen sind nötig, um einen vertrauenswürdigen Trend zu zeichnen.",
  historicalSignal: "Historisches Signal",
  observations: "{count} Beobachtungen",
  trendRange: "{title}, von {min} bis {max}",
} as const;
