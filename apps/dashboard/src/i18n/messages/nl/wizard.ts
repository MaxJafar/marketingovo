import type { MessagesFor } from "../types";

/** Workspace setup wizard: five linear steps from empty install to first runs. */
export const wizard: MessagesFor<"wizard"> = {
  eyebrow: "Setup",
  title: "Maak je marketingwerkruimte",
  description:
    "Vijf stappen naar een dashboard met echte data. Alleen een merknaam is verplicht.",
  progressLabel: "Setupvoortgang",
  optional: "Optioneel",
  errorTitle: "Die stap kon niet worden opgeslagen",
  genericError: "Er ging iets mis.",
  launchError: "Kon de runs niet starten.",
  back: "Terug",
  continue: "Doorgaan",
  saving: "Opslaan…",
  starting: "Starten…",
  startRuns: "Start de eerste runs",
  goToDashboard: "Naar het dashboard",
  steps: {
    workspace: { label: "Werkruimte", hint: "Geef het merk een naam." },
    brand: { label: "Merkaanwezigheid", hint: "Waar het merk nog meer leeft." },
    competitors: {
      label: "Concurrenten",
      hint: "Tegen wie je wordt afgemeten.",
    },
    data: { label: "Databronnen", hint: "Optioneel. Overslaanbaar." },
    launch: { label: "Controleren", hint: "Start de eerste runs." },
  },
  providers: {
    googleSearchConsole: {
      label: "Google Search Console",
      why: "Rangschikt bevindingen op de zoekopdrachten en pagina's die daadwerkelijk vertoningen verdienen.",
      field: "Property-URL of sc-domain-identifier",
    },
    googleAnalytics4: {
      label: "Google Analytics 4",
      why: "Weegt bevindingen op sessies en conversies in plaats van alleen ernst.",
      field: "Property-ID",
    },
    pagespeedInsights: {
      label: "PageSpeed Insights",
      why: "Voegt veldmetingen van Core Web Vitals toe aan de technische audit.",
      field: "API-sleutel",
    },
    serpapi: {
      label: "SerpAPI",
      why: "Vereist voor live positietracking. Zonder deze sleutel blijven posities ongemeten.",
      field: "API-sleutel",
    },
  },
  runs: {
    baselineAudit: "Basisaudit",
    competitorComparison: "Concurrentvergelijking",
    osintDossier: "Publiek-web OSINT-dossier",
  },
  workspace: {
    title: "Wat gaan we volgen?",
    description:
      "De werkruimte is vernoemd naar het merk. Voeg alleen een website toe als je die gecrawld wilt hebben.",
    brandName: "Merknaam",
    website: "Website",
    websiteHelp:
      "Alleen nodig voor crawling en SEO-audits. Social, advertenties en onderzoek werken ook zonder, en je kunt er later een toevoegen via Instellingen. https:// wordt toegevoegd als je het weglaat.",
    summaryLabel: "Wat doet dit merk?",
    summaryHelp:
      "Vastgelegd als werkruimtecontext, zodat rapporten en agents dezelfde achtergrond delen.",
  },
  brand: {
    title: "Waar leeft het merk nog meer?",
    description:
      "Elk profiel wordt tegen je crawl gecontroleerd: of een pagina ernaartoe linkt, en of het is gedeclareerd in schema.org sameAs. Een niet-gelinkt profiel is onzichtbaar voor zoekmachines.",
    label: "Label",
    profileUrl: "Profiel-URL",
    removeProfile: "Profiel {number} verwijderen",
    remove: "Verwijderen",
    addProfile: "Nog een profiel toevoegen",
  },
  competitors: {
    title: "Tegen wie word je afgemeten?",
    description:
      "Elke concurrent wordt gecrawld met dezelfde limieten als je eigen site. Publicatieritme en contentgaten komen uit hun pagina's, dus er is geen providersleutel nodig.",
    domains: "Concurrentdomeinen",
    domainsHelp:
      "Eén per regel. De eerste twee worden vergeleken in de openingsrun; de rest wordt bewaard in de werkruimtecontext.",
  },
  data: {
    title: "Verbind je data",
    description:
      "Elk van deze is optioneel. Sla ze over en de audit draait nog steeds — bevindingen worden gerangschikt op technische ernst en bereik, en alles wat een bron nodig heeft wordt gemeld als niet beschikbaar in plaats van gegokt.",
    storageTitle: "Waar deze worden opgeslagen",
    storageBody:
      "Credentials gaan naar de lokale credentialkluis op deze machine en worden nooit weggeschreven in rapporten, logs of artefacten.",
  },
  launch: {
    title: "Klaar om te draaien",
    description:
      "De basisaudit, de concurrentvergelijking en de optionele publiek-web OSINT-pass worden samen in de wachtrij gezet.",
    brand: "Merk",
    unnamed: "Naamloos",
    website: "Website",
    notSet: "Niet ingesteld",
    brandProfiles: "Merkprofielen",
    noProfiles: "Geen — merkaanwezigheid wordt niet gecontroleerd",
    competitors: "Concurrenten",
    noCompetitors: "Geen — marktintel blijft leeg",
    dataSources: "Databronnen",
    providersConfigured: "{count} geconfigureerd",
    noProviders: "Geen — bevindingen alleen gerangschikt op ernst en bereik",
    osint: "Publiek-web OSINT",
    osintIncluded:
      "Inbegrepen — geciteerde publieke signalen en historie van herhaalde passes",
    osintSkippedPrivate: "Overgeslagen — publiek doel vereist",
    osintSkippedChoice: "Bewust overgeslagen",
    integrationsDetected: "Gedetecteerde integraties",
    integrationsAvailable: "{count} beschikbaar",
    checking: "Controleren…",
    osintLabel: "Neem het publiek-web OSINT-dossier mee",
    osintHelp:
      "Aanbevolen. Gebruikt alleen deze site en de expliciete concurrent-URL's hierboven, met bronvermeldingen, beschikbaarheidsstatussen en zonder personenzoeken, ingelogd scrapen of dark-webverzameling. Privé- of loopback-concurrent-URL's worden uitgesloten.",
    osintOff:
      "OSINT blijft uit voor {host}; het is beperkt tot publieke doelen. De basismeting kan nog steeds draaien met de privéhost-autorisatie hierboven.",
    privateTitle: "Deze run richt zich op een privéadres",
    privateBodyOne:
      "{hosts} staat op een privé- of loopbacknetwerk. De crawler weigert deze tenzij je ze voor deze werkruimte autoriseert.",
    privateBodyMany:
      "{hosts} staan op een privé- of loopbacknetwerk. De crawler weigert deze tenzij je ze voor deze werkruimte autoriseert.",
    allowOne:
      "Sta crawlen van deze host toe. Alleen precies deze hosts worden geautoriseerd; de rest van het privénetwerk blijft geblokkeerd.",
    allowMany:
      "Sta crawlen van deze hosts toe. Alleen precies deze hosts worden geautoriseerd; de rest van het privénetwerk blijft geblokkeerd.",
    startedTitle: "Runs gestart",
    queuedJoiner: " en ",
    queued:
      "{runs} in de wachtrij. De voortgang is zichtbaar onder Audits; deze werkruimte vult zich terwijl elke run afrondt.",
  },
} as const;
