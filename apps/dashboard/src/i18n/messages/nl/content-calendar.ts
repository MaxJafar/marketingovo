import type { MessagesFor } from "../types";

/** The content calendar: entries, approvals, publish records, and media. */
export const contentCalendar: MessagesFor<"contentCalendar"> = {
  entry: {
    noTimeSet: "geen tijd ingesteld",
    attachmentSingular: "{count} bijlage",
    attachmentPlural: "{count} bijlagen",
    sent: "Verzonden {time}",
    openPost: "open de post",
    indeterminate:
      "Er is een verzoek verstuurd en geen antwoord vastgelegd, dus of deze post is verschenen is onbekend. Controleer {platform} voordat je het opnieuw probeert — Marketingovo verstuurt niet uit zichzelf opnieuw.",
    refusedFallback: "De provider heeft deze post geweigerd.",
    needsTimeTitle: "Geef de post een tijd voordat je hem goedkeurt.",
    approve: "Goedkeuren voor deze tijd",
    sending: "Verzenden…",
    sendNow: "Nu verzenden",
  },
  media: {
    title: "Media",
    uploadLabel: "Media uploaden",
    sizeKb: "{size}KB",
    publiclyReachable:
      "Publiek bereikbaar ({source}). Instagram kan dit ophalen.",
    storedLocally:
      "Alleen op deze machine opgeslagen. Telegram, X en Facebook posten het rechtstreeks; Instagram niet, omdat het media van een publieke URL ophaalt in plaats van een upload te accepteren.",
    relayTitle:
      "Uploadt dit bestand naar de objectopslag die je hebt geconfigureerd, zodat Instagram het kan ophalen.",
    uploading: "Uploaden…",
    relay: "Naar mijn opslag publiceren",
    urlPlaceholder: "of plak een publieke https:// URL die je zelf host",
    useUrl: "Deze URL gebruiken",
    uploadRefused: "De upload is geweigerd.",
    empty:
      "Nog geen media. Bestanden die je uploadt blijven op deze machine en worden rechtstreeks naar Telegram, X en Facebook verstuurd wanneer een post live gaat.",
  },
  overdue: {
    title: "Over hun tijd heen en niet verzonden",
    body: "Deze stonden gepland voor een moment dat is verstreken en zijn nooit goedgekeurd, dus er is niets verzonden. Een kalender die alleen cellen tekende zou ze hebben verborgen.",
  },
  week: {
    title: "Komende twee weken",
    loading: "Kalender lezen…",
    emptyBefore: "Er staat niets gepland. Schrijf een post in",
    composerLink: "de composer",
    emptyAfter:
      "of vraag een gekoppelde agent er een te schrijven, en geef hem hier een tijd.",
  },
  unscheduled: {
    title: "Geschreven, wacht op een tijd",
    body: "Kies een tijd en keur goed. De tijd wijzigen van een al goedgekeurde post wist de goedkeuring, want de tijd is onderdeel van wat je hebt goedgekeurd.",
    timeLabel: "Geplande tijd",
    schedule: "Geselecteerde post inplannen",
    scheduleFailed: "De post kon niet worden ingepland.",
  },
} as const;
