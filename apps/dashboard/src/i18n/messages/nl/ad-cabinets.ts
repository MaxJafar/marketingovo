import type { MessagesFor } from "../types";

/**
 * Ad Cabinets — connections, linked cabinets, stored performance, wasted
 * queries, and the spend-approval queue. Conventions in shell.ts.
 */
export const adCabinets: MessagesFor<"adCabinets"> = {
  platformLabel: {
    all: "Alle plaatsingen",
    facebook: "Facebook",
    instagram: "Instagram",
    messenger: "Messenger",
    audience_network: "Audience Network",
    google_search: "Google Zoeken",
    google_search_partners: "Zoekpartners",
    google_display: "Google Display",
    google_youtube: "YouTube",
    google_performance_max: "Performance Max",
    unknown: "Overige plaatsing",
  },
  metricLabel: {
    spend: "Uitgaven",
    impressions: "Vertoningen",
    clicks: "Klikken",
    link_clicks: "Linkklikken",
    conversions: "Conversies",
    conversion_value: "Conversiewaarde",
    cost_per_conversion: "Kosten per conversie",
    ctr: "CTR",
    cpc: "CPC",
    cpm: "CPM",
    reach: "Bereik",
    frequency: "Frequentie",
    video_plays: "Videoweergaven",
  },
  state: {
    partial: "gedeeltelijk — {observed}/{requested} dagen",
    failed: "kon niet worden gelezen",
    unavailable: "niet gemeten",
  },
  performance: {
    loading: "Opgeslagen metingen lezen…",
    unreadable: "De metingen van dit account konden niet worden gelezen.",
    neverSynced:
      "Nooit gesynchroniseerd. Draai een betaalde audit om de uitgaven en levering van dit account te lezen. Er wordt niets getoond totdat er iets is gemeten.",
    syncedRange: "{start} tot {end}. Laatst gesynchroniseerd {date}.",
    metricHeader: "Metriek",
    valueHeader: "Waarde",
    coverageHeader: "Dekking",
    coverageComplete: "volledig",
    metricNote: "{metric}: {note}",
  },
  wasted: {
    heading: "Zoekopdrachten die een beslissing verdienen",
    loading: "Opgeslagen zoektermen lezen…",
    empty:
      "Nog geen zoektermen opgeslagen voor dit account. Draai een betaalde audit.",
    queryHeader: "Zoekopdracht",
    matchedHeader: "Gematcht",
    clicksHeader: "Klikken",
    costHeader: "Kosten",
    conversionsHeader: "Conversies",
    footnote:
      "Alleen Zoeken en Shopping. Performance Max en Demand Gen rapporteren helemaal geen zoekopdrachten, en Google houdt termen achter die te zeldzaam zijn om te anonimiseren, dus dit dekt nooit alle klikken van een account. Een korte lijst is geen bewijs dat er niets wordt verspild.",
  },
  queue: {
    heading: "Wacht op jouw goedkeuring",
    empty:
      "Er wacht niets op goedkeuring. Een gekoppelde agent kan een campagne opstellen en hier klaarzetten; goedkeuren kan hij niet, en dit product kan zelf ook nog niets naar een advertentieplatform sturen. Google Ads is bewust alleen-lezen — zie ADR 0008.",
    perDay: "{amount} per dag",
    lifetime: "{amount} totaal",
    noBudget: "Geen budget opgegeven",
    stagedOne:
      "{count} klaargezette payload. Lees het exacte verzoek voordat je goedkeurt — de goedkeuring is gebonden aan deze versie, en een payload die daarna wordt bewerkt moet opnieuw worden goedgekeurd.",
    stagedMany:
      "{count} klaargezette payloads. Lees het exacte verzoek voordat je goedkeurt — de goedkeuring is gebonden aan deze versie, en een payload die daarna wordt bewerkt moet opnieuw worden goedgekeurd.",
    stagedBy: "Klaargezet door {name} op {date}. Payload {hash}…",
    hidePayload: "Payload verbergen",
    readPayload: "Payload lezen",
    readBeforeApproving: "Lees de payload voordat je hem goedkeurt.",
    approveExact: "Precies deze payload goedkeuren",
    withdraw: "Intrekken",
    approvalRefused: "De goedkeuring is geweigerd.",
    footnote:
      "Goedkeuren legt je instemming met precies deze payload vast. Het verstuurt niets: deze build heeft bewust geen uitgaand schrijfpad naar Meta.",
  },
  connections: {
    heading: "Verbindingen",
    integrationsLink: "Integraties",
    metaExpiredBefore:
      "Het Meta-toegangstoken is verlopen. Meta System User-tokens hebben een vaste levensduur en vernieuwen niet — genereer een nieuw token in Business Manager en plak het in",
    metaExpiredAfter:
      ". Tot die tijd zijn uitgaven en levering onleesbaar in plaats van nul.",
    metaConnectedExpiry:
      "Meta is verbonden. Het token verloopt {date} — roteer het vóór die tijd.",
    metaConnected: "Meta is verbonden.",
    metaMissingBefore:
      "Meta is niet verbonden, dus uitgaven op Facebook en Instagram kunnen niet worden gelezen. Genereer een System User-token in Meta Business Manager en plak het in",
    metaMissingAfter: ".",
    googleExpiredBefore:
      "De Google-aanmelding voor Google Ads is verlopen. Verbind hem opnieuw in",
    googleExpiredAfter:
      ". Tot die tijd zijn Google-uitgaven onleesbaar in plaats van nul.",
    googleConnected: "Google Ads is verbonden.",
    googleMissingBefore:
      "Google Ads is niet verbonden. Er zijn twee dingen nodig: een Google-aanmelding en een eigen developer token uit het API Center van een Google Ads-manageraccount. Marketingovo levert geen developer token mee — één token in de app gecompileerd zou elke installatie tot één identiteit richting Google maken, en de bijbehorende limieten en voorwaarden gelden voor wie het token houdt. Google keurt nieuwe tokens handmatig goed, dus vraag er een aan voordat je hem nodig hebt. Beide gaan in",
    googleMissingAfter: ".",
  },
  cabinets: {
    heading: "Advertentieaccounts",
    providerSelectLabel: "Provider om accounts bij te zoeken",
    asking: "{provider} vragen…",
    findAccounts: "Vind mijn accounts",
    starting: "Starten…",
    runPaidAudit: "Betaalde audit draaien",
    auditCheckBefore:
      "De betaalde audit controleert ook de pagina's waar deze advertenties mensen naartoe sturen — bestemmingen die een 404 geven, redirects die de klik-identifier laten vallen, en landingspagina's die nergens noemen waarop wordt geboden. Bevindingen verschijnen in",
    actionsLink: "Acties",
    auditCheckAfter:
      ". Eerst een SEO-audit draaien maakt de controle goedkoper en voegt paginasnelheid toe; zonder audit wordt elke bestemming rechtstreeks opgehaald.",
    empty:
      "Er is geen advertentieaccount aan deze werkruimte gekoppeld. Eén login bereikt meestal meerdere accounts, en welke daarvan deze werkruimte leest is jouw beslissing — een provider verbinden koppelt op zichzelf niets.",
    billsIn: "factureert in {currency}",
    noCurrency: "geen valuta gerapporteerd voor dit account",
    dailyCap: "daglimiet {cap}",
    noDailyCap: "geen lokale daglimiet ingesteld",
    hidePerformance: "Prestaties verbergen",
    showPerformance: "Prestaties tonen",
    archive: "Archiveren",
    remove: "Verwijderen",
    removeTitle:
      "Verwijdert het account en elke meting die eraan is vastgelegd.",
    discoveryFailed: "{provider} was niet bereikbaar om accounts te vinden.",
    discoveredHeading: "Accounts die deze credential kan bereiken",
    linked: "Gekoppeld",
    linkToWorkspace: "Aan deze werkruimte koppelen",
  },
} as const;
