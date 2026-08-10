import type { MessagesFor } from "../types";

/**
 * Ad Cabinets — connections, linked cabinets, stored performance, wasted
 * queries, and the spend-approval queue. Conventions in shell.ts.
 */
export const adCabinets: MessagesFor<"adCabinets"> = {
  platformLabel: {
    all: "Alle Platzierungen",
    facebook: "Facebook",
    instagram: "Instagram",
    messenger: "Messenger",
    audience_network: "Audience Network",
    google_search: "Google Suche",
    google_search_partners: "Suchnetzwerk-Partner",
    google_display: "Google Display",
    google_youtube: "YouTube",
    google_performance_max: "Performance Max",
    unknown: "Andere Platzierung",
  },
  metricLabel: {
    spend: "Ausgaben",
    impressions: "Impressionen",
    clicks: "Klicks",
    link_clicks: "Link-Klicks",
    conversions: "Conversions",
    conversion_value: "Conversion-Wert",
    cost_per_conversion: "Kosten pro Conversion",
    ctr: "CTR",
    cpc: "CPC",
    cpm: "CPM",
    reach: "Reichweite",
    frequency: "Frequenz",
    video_plays: "Videowiedergaben",
  },
  state: {
    partial: "teilweise — {observed}/{requested} Tage",
    failed: "konnte nicht gelesen werden",
    unavailable: "nicht gemessen",
  },
  performance: {
    loading: "Gespeicherte Messungen werden gelesen…",
    unreadable:
      "Die Messungen dieses Werbekontos konnten nicht gelesen werden.",
    neverSynced:
      "Nie synchronisiert. Starte ein Paid-Audit, um Ausgaben und Auslieferung dieses Werbekontos zu lesen. Es wird nichts angezeigt, bis etwas gemessen wurde.",
    syncedRange: "{start} bis {end}. Zuletzt synchronisiert {date}.",
    metricHeader: "Metrik",
    valueHeader: "Wert",
    coverageHeader: "Abdeckung",
    coverageComplete: "vollständig",
    metricNote: "{metric}: {note}",
  },
  wasted: {
    heading: "Suchanfragen, die eine Entscheidung verdienen",
    loading: "Gespeicherte Suchbegriffe werden gelesen…",
    empty:
      "Für dieses Konto sind noch keine Suchbegriffe gespeichert. Starte ein Paid-Audit.",
    queryHeader: "Suchanfrage",
    matchedHeader: "Zugeordnet",
    clicksHeader: "Klicks",
    costHeader: "Kosten",
    conversionsHeader: "Conversions",
    footnote:
      "Nur Suche und Shopping. Performance Max und Demand Gen melden gar keine Suchanfragen, und Google hält Begriffe zurück, die zu selten sind, um sie zu anonymisieren — diese Liste erfasst also nie alle Klicks eines Kontos. Eine kurze Liste ist kein Beleg dafür, dass nichts verschwendet wird.",
  },
  queue: {
    heading: "Wartet auf deine Freigabe",
    empty:
      "Nichts wartet auf Freigabe. Ein angebundener Agent kann eine Kampagne entwerfen und hier bereitstellen; freigeben kann er sie nicht, und auch dieses Produkt sendet noch nichts an eine Werbeplattform. Google Ads ist per Design schreibgeschützt — siehe ADR 0008.",
    perDay: "{amount} pro Tag",
    lifetime: "{amount} gesamt",
    noBudget: "Kein Budget angegeben",
    stagedOne:
      "{count} bereitgestellte Payload. Lies die exakte Anfrage vor der Freigabe — die Freigabe bindet sich an diese Version, und eine danach bearbeitete Payload muss erneut freigegeben werden.",
    stagedMany:
      "{count} bereitgestellte Payloads. Lies die exakte Anfrage vor der Freigabe — die Freigabe bindet sich an diese Version, und eine danach bearbeitete Payload muss erneut freigegeben werden.",
    stagedBy: "Bereitgestellt von {name} am {date}. Payload {hash}…",
    hidePayload: "Payload ausblenden",
    readPayload: "Payload lesen",
    readBeforeApproving: "Lies die Payload, bevor du sie freigibst.",
    approveExact: "Genau diese Payload freigeben",
    withdraw: "Zurückziehen",
    approvalRefused: "Die Freigabe wurde abgelehnt.",
    footnote:
      "Die Freigabe protokolliert deine Zustimmung zu genau dieser Payload. Gesendet wird nichts: Dieser Build hat per Design keinen ausgehenden Schreibpfad zu Meta.",
  },
  connections: {
    heading: "Verbindungen",
    integrationsLink: "Integrationen",
    metaExpiredBefore:
      "Das Meta-Zugriffstoken ist abgelaufen. Meta-System-User-Tokens haben eine feste Laufzeit und erneuern sich nicht — erzeuge im Business Manager ein neues und füge es ein unter",
    metaExpiredAfter:
      ". Bis dahin sind Ausgaben und Auslieferung nicht lesbar statt null.",
    metaConnectedExpiry:
      "Meta ist verbunden. Das Token läuft am {date} ab — rotiere es vorher.",
    metaConnected: "Meta ist verbunden.",
    metaMissingBefore:
      "Meta ist nicht verbunden, daher lassen sich Facebook- und Instagram-Ausgaben nicht lesen. Erzeuge im Meta Business Manager ein System-User-Token und füge es ein unter",
    metaMissingAfter: ".",
    googleExpiredBefore:
      "Die Google-Anmeldung für Google Ads ist abgelaufen. Verbinde sie neu unter",
    googleExpiredAfter:
      ". Bis dahin sind Google-Ausgaben nicht lesbar statt null.",
    googleConnected: "Google Ads ist verbunden.",
    googleMissingBefore:
      "Google Ads ist nicht verbunden. Es braucht zwei Dinge: eine Google-Anmeldung und ein eigenes Entwickler-Token aus dem API Center eines Google Ads-Verwaltungskontos. Marketingovo liefert kein Entwickler-Token mit — eines, das in die App einkompiliert wäre, machte jede Installation gegenüber Google zu einer einzigen Identität, und seine Rate-Limits und Bedingungen hängen an dem, der es hält. Google genehmigt neue Tokens von Hand, beantrage es also, bevor du es brauchst. Beides gehört in",
    googleMissingAfter: ".",
  },
  cabinets: {
    heading: "Werbekonten",
    providerSelectLabel: "Anbieter, bei dem nach Konten gesucht wird",
    asking: "{provider} wird gefragt…",
    findAccounts: "Meine Konten finden",
    starting: "Wird gestartet…",
    runPaidAudit: "Paid-Audit starten",
    auditCheckBefore:
      "Das Paid-Audit prüft auch die Seiten, auf die diese Anzeigen führen — Ziele, die mit 404 antworten, Redirects, die die Klick-Kennung verlieren, und Landingpages, die nie erwähnen, worauf geboten wird. Die Funde erscheinen unter",
    actionsLink: "Maßnahmen",
    auditCheckAfter:
      ". Ein vorher gelaufenes SEO-Audit macht die Prüfung günstiger und ergänzt Seitengeschwindigkeit; ohne eines wird jedes Ziel direkt abgerufen.",
    empty:
      "Mit diesem Workspace ist kein Werbekonto verknüpft. Ein Login erreicht meist mehrere Konten, und welche davon dieser Workspace liest, ist deine Entscheidung — das Verbinden eines Anbieters verknüpft für sich genommen nichts.",
    billsIn: "rechnet ab in {currency}",
    noCurrency: "keine Währung für dieses Konto gemeldet",
    dailyCap: "Tageslimit {cap}",
    noDailyCap: "kein lokales Tageslimit gesetzt",
    hidePerformance: "Performance ausblenden",
    showPerformance: "Performance anzeigen",
    archive: "Archivieren",
    remove: "Entfernen",
    removeTitle:
      "Entfernt das Werbekonto und jede dafür aufgezeichnete Messung.",
    discoveryFailed: "{provider} war für die Kontosuche nicht erreichbar.",
    discoveredHeading: "Konten, die diese Zugangsdaten erreichen",
    linked: "Verknüpft",
    linkToWorkspace: "Mit diesem Workspace verknüpfen",
  },
} as const;
