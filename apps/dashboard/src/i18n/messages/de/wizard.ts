import type { MessagesFor } from "../types";

/** Workspace setup wizard: five linear steps from empty install to first runs. */
export const wizard: MessagesFor<"wizard"> = {
  eyebrow: "Setup",
  title: "Lege deinen Marketing-Workspace an",
  description:
    "Fünf Schritte zu einem Dashboard mit echten Daten. Nur ein Markenname ist Pflicht.",
  progressLabel: "Setup-Fortschritt",
  optional: "Optional",
  errorTitle: "Dieser Schritt konnte nicht gespeichert werden",
  genericError: "Etwas ist schiefgelaufen.",
  launchError: "Läufe konnten nicht gestartet werden.",
  back: "Zurück",
  continue: "Weiter",
  saving: "Wird gespeichert…",
  starting: "Wird gestartet…",
  startRuns: "Die ersten Läufe starten",
  goToDashboard: "Zum Dashboard",
  steps: {
    workspace: { label: "Workspace", hint: "Benenne die Marke." },
    brand: { label: "Markenpräsenz", hint: "Wo die Marke sonst noch lebt." },
    competitors: { label: "Wettbewerber", hint: "An wem gemessen wird." },
    data: { label: "Datenquellen", hint: "Optional. Überspringbar." },
    launch: { label: "Überprüfung", hint: "Die ersten Läufe starten." },
  },
  providers: {
    googleSearchConsole: {
      label: "Google Search Console",
      why: "Rankt Befunde nach den Suchanfragen und Seiten, die tatsächlich Impressionen holen.",
      field: "Property-URL oder sc-domain-Kennung",
    },
    googleAnalytics4: {
      label: "Google Analytics 4",
      why: "Gewichtet Befunde nach Sitzungen und Conversions statt nur nach Schweregrad.",
      field: "Property-ID",
    },
    pagespeedInsights: {
      label: "PageSpeed Insights",
      why: "Ergänzt das technische Audit um Feld-Core-Web-Vitals.",
      field: "API-Key",
    },
    serpapi: {
      label: "SerpAPI",
      why: "Nötig für Live-Rank-Tracking. Ohne bleibt jede Position ungemessen.",
      field: "API-Key",
    },
  },
  runs: {
    baselineAudit: "Baseline-Audit",
    competitorComparison: "Wettbewerbervergleich",
    osintDossier: "Public-Web-OSINT-Dossier",
  },
  workspace: {
    title: "Was tracken wir?",
    description:
      "Der Workspace ist nach der Marke benannt. Füge eine Website nur hinzu, wenn sie gecrawlt werden soll.",
    brandName: "Markenname",
    website: "Website",
    websiteHelp:
      "Nur für Crawling und SEO-Audits nötig. Social, Ads und Recherche funktionieren ohne, und du kannst später in den Einstellungen eine hinzufügen. https:// wird ergänzt, wenn du es weglässt.",
    summaryLabel: "Was macht diese Marke?",
    summaryHelp:
      "Als Workspace-Kontext gespeichert, damit Berichte und Agenten denselben Hintergrund teilen.",
  },
  brand: {
    title: "Wo lebt die Marke sonst noch?",
    description:
      "Jedes Profil wird gegen deinen Crawl geprüft: ob irgendeine Seite darauf verlinkt und ob es in schema.org sameAs deklariert ist. Ein unverlinktes Profil ist für Suchmaschinen unsichtbar.",
    label: "Label",
    profileUrl: "Profil-URL",
    removeProfile: "Profil {number} entfernen",
    remove: "Entfernen",
    addProfile: "Weiteres Profil hinzufügen",
  },
  competitors: {
    title: "An wem wirst du gemessen?",
    description:
      "Jeder Wettbewerber wird mit denselben Limits gecrawlt wie deine eigene Site. Publikationsrhythmus und Content-Lücken kommen aus seinen Seiten, ein Provider-Key ist also nicht nötig.",
    domains: "Wettbewerber-Domains",
    domainsHelp:
      "Eine pro Zeile. Die ersten zwei werden im Eröffnungslauf verglichen; der Rest bleibt im Workspace-Kontext.",
  },
  data: {
    title: "Verbinde deine Daten",
    description:
      "Jede dieser Quellen ist optional. Überspring sie, und das Audit läuft trotzdem — Befunde werden nach technischem Schweregrad und Reichweite gerankt, und alles, was eine Quelle bräuchte, wird als nicht verfügbar gemeldet statt geraten.",
    storageTitle: "Wo diese gespeichert werden",
    storageBody:
      "Zugangsdaten gehen in den lokalen Credential-Vault auf diesem Rechner und werden nie in Berichte, Logs oder Artefakte geschrieben.",
  },
  launch: {
    title: "Bereit zum Start",
    description:
      "Das Baseline-Audit, der Wettbewerbervergleich und der optionale Public-Web-OSINT-Durchlauf werden gemeinsam eingereiht.",
    brand: "Marke",
    unnamed: "Unbenannt",
    website: "Website",
    notSet: "Nicht gesetzt",
    brandProfiles: "Markenprofile",
    noProfiles: "Keine — die Markenpräsenz wird nicht geprüft",
    competitors: "Wettbewerber",
    noCompetitors: "Keine — Market Intel bleibt leer",
    dataSources: "Datenquellen",
    providersConfigured: "{count} konfiguriert",
    noProviders:
      "Keine — Befunde werden nur nach Schweregrad und Reichweite gerankt",
    osint: "Public-Web-OSINT",
    osintIncluded:
      "Enthalten — zitierte öffentliche Signale und Historie über Wiederholungsläufe",
    osintSkippedPrivate: "Übersprungen — öffentliches Ziel erforderlich",
    osintSkippedChoice: "Bewusst übersprungen",
    integrationsDetected: "Erkannte Integrationen",
    integrationsAvailable: "{count} verfügbar",
    checking: "Wird geprüft…",
    osintLabel: "Public-Web-OSINT-Dossier einbeziehen",
    osintHelp:
      "Empfohlen. Nutzt nur diese Site und die expliziten Wettbewerber-URLs oben, mit Quell-Links und Verfügbarkeitszuständen und ohne Personensuche, authentifiziertes Scraping oder Darkweb-Sammlung. Private oder Loopback-Wettbewerber-URLs werden ausgeschlossen.",
    osintOff:
      "OSINT bleibt für {host} aus; es ist auf öffentliche Ziele beschränkt. Die Baseline kann mit der Privat-Host-Freigabe oben trotzdem laufen.",
    privateTitle: "Dieser Lauf zielt auf eine private Adresse",
    privateBodyOne:
      "{hosts} liegt in einem privaten oder Loopback-Netzwerk. Der Crawler verweigert diese, solange du sie nicht für diesen Workspace freigibst.",
    privateBodyMany:
      "{hosts} liegen in einem privaten oder Loopback-Netzwerk. Der Crawler verweigert diese, solange du sie nicht für diesen Workspace freigibst.",
    allowOne:
      "Das Crawlen dieses Hosts erlauben. Nur genau diese Hosts werden freigegeben; der Rest des privaten Netzwerks bleibt blockiert.",
    allowMany:
      "Das Crawlen dieser Hosts erlauben. Nur genau diese Hosts werden freigegeben; der Rest des privaten Netzwerks bleibt blockiert.",
    startedTitle: "Läufe gestartet",
    queuedJoiner: " und ",
    queued:
      "{runs} eingereiht. Der Fortschritt ist unter Audits sichtbar; dieser Workspace füllt sich, während jeder Lauf abschließt.",
  },
} as const;
