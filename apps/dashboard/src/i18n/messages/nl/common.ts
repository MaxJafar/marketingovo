import type { MessagesFor } from "../types";

/** Shared primitives: formatters, query states, capability gates, freshness. */
export const common: MessagesFor<"common"> = {
  unavailable: "Niet beschikbaar",
  noComparison: "Geen vergelijking beschikbaar",
  vsPriorPeriod: "{change}% t.o.v. vorige periode",
  createWorkspaceTitle: "Maak een werkruimte om te beginnen",
  createWorkspaceBody:
    "Een werkruimte bevat je kanalen, onderzoek en notities. Maak er een om te starten — een website toevoegen kan later, of nooit.",
  loadingLabel: "Data laden",
  errorTitle: "Data is niet beschikbaar",
  errorFallback: "De API gaf deze werkruimte niet terug.",
  errorHint:
    "Geen enkele waarde is vervangen door nul. Controleer de lokale API en de integratiegezondheid.",
  tryAgain: "Opnieuw proberen",
  gateTitle: "Hier is nog één ding voor nodig",
  gateHint:
    "Al het andere in deze werkruimte blijft werken. Niets hier is opgevuld met een placeholder.",
  freshness: {
    stale:
      "Deze weergave gebruikt de laatst beschikbare snapshot. Recente veranderingen zijn mogelijk niet meegenomen.",
    missing:
      "Een of meer bronnen hebben voor deze weergave geen data geleverd.",
    unavailable: "Een of meer bronnen waren niet bereikbaar.",
    unknown: "De API gaf voor dit antwoord geen versheidsgarantie.",
    fresh: "Het antwoord bevat bronwaarschuwingen.",
  },
  snapshot: "Snapshot: {time}",
  invalidSessionResponse:
    "De lokale service gaf een ongeldig sessie-antwoord terug.",
  importTooLarge: "Het .marketingovo-bestand mag maximaal 25 MiB zijn.",
  importWrongExtension: "Kies een bestand met de extensie .marketingovo.",
  serviceUnreachable: "De lokale service is niet bereikbaar.",
  messageNotSent: "Dat bericht is niet verzonden.",
  trendUnavailable: "Trend niet beschikbaar",
  trendEmptyBody:
    "Er zijn minstens twee gedateerde metingen nodig om een betrouwbare trend te tekenen.",
  historicalSignal: "Historisch signaal",
  observations: "{count} waarnemingen",
  trendRange: "{title}, van {min} tot {max}",
} as const;
