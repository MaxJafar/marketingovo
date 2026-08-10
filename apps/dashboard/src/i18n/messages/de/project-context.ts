import type { MessagesFor } from "../types";

/** Project context page: versioned profile, journal, and revision history. */
export const projectContext: MessagesFor<"projectContext"> = {
  eyebrow: "Wiederverwendbares Strategiegedächtnis",
  title: "Projektkontext",
  description:
    "Halte Geschäftsziele, Zielgruppen, Märkte, Grenzen und Entscheidungen neben der Crawl-Evidenz, damit jeder Mensch und jeder Agent von denselben Fakten ausgeht.",
  revisionSavedTitle: "Kontext-Revision gespeichert",
  revisionSavedBody:
    "Die vorherige Revision bleibt unveränderlich und in der Historie verfügbar.",
  revisionNotSavedTitle: "Kontext wurde nicht gespeichert",
  journalAppendedTitle: "Journaleintrag angehängt",
  journalAppendedBody:
    "Der Eintrag ist unveränderlich und steht jetzt lokalen Agenten-Ressourcen zur Verfügung.",
  journalNotAppendedTitle: "Journaleintrag wurde nicht angehängt",
  revisionLabel: "Revision {revision}",
  profile: {
    eyebrow: "Versioniertes Profil",
    createFirstRevision: "Erste Revision anlegen",
    savedAt: "Gespeichert {date}",
    summaryLabel: "Geschäfts- und Suchzusammenfassung",
    summaryPlaceholder:
      "Was bietet das Unternehmen an, für wen, und was muss die organische Suche jetzt leisten?",
    oneItemPerLine: "Ein Eintrag pro Zeile.",
    changeSummaryLabel: "Revisionszusammenfassung",
    changeSummaryPlaceholder: "UK-Markt ergänzt und Demo-Conversion präzisiert",
    changeSummaryHelp:
      "Erkläre, was sich geändert hat. Speichern erzeugt immer eine neue unveränderliche Revision.",
    saving: "Revision wird gespeichert…",
    save: "Neue Revision speichern",
  },
  profileLists: {
    audiences: {
      label: "Prioritäre Zielgruppen",
      help: "Wer muss diese Site finden, ihr vertrauen und handeln?",
      placeholder: "Technical-SEO-Leads\nB2B-Growth-Teams",
    },
    markets: {
      label: "Märkte",
      help: "Länder, Regionen oder kommerzielle Segmente, die den Intent verändern.",
      placeholder: "Vereinigte Staaten\nVereinigtes Königreich",
    },
    languages: {
      label: "Sprachen",
      help: "Nutze die Bezeichnungen, die dein Team kennt; ergänze die Locale, wo relevant.",
      placeholder: "Englisch (en-US)\nDeutsch (de-DE)",
    },
    conversionGoals: {
      label: "Conversion-Ziele",
      help: "Benenne die Events, die organische Arbeit wertvoll machen.",
      placeholder: "Qualifizierte Demo-Anfrage\nTrial-Aktivierung",
    },
    priorityTopics: {
      label: "Prioritäre Themen",
      help: "Produkte, Probleme oder Themen, die die aktuelle Strategie tragen muss.",
      placeholder: "Technical-SEO-Automatisierung\nLocal-First-Analytics",
    },
    competitors: {
      label: "Bekannte Wettbewerber",
      help: "Marken oder Domains für einen fairen, expliziten Vergleich.",
      placeholder: "beispiel-wettbewerber.de\nAlternativer Kategorieführer",
    },
    constraints: {
      label: "Grenzen und Leitplanken",
      help: "Rechtliche, Marken-, Plattform-, Migrations- oder Ressourcen-Grenzen.",
      placeholder:
        "Checkout-URLs nicht ändern\nRechtliche Prüfung für Claims erforderlich",
    },
  },
  journalKinds: {
    observation: "Beobachtung",
    decision: "Entscheidung",
    constraint: "Grenze",
    experiment: "Experiment",
  },
  journalForm: {
    eyebrow: "Append-only-Journal",
    heading: "Halte fest, was die Strategie verändert hat",
    kindLabel: "Eintragstyp",
    sourceLabel: "Quell-Audit (optional)",
    noLinkedAudit: "Kein verknüpftes Audit",
    titleLabel: "Titel des Eintrags",
    titlePlaceholder: "UK-Vergleichsseiten konvertieren qualifizierte Demos",
    detailLabel: "Evidenz und Implikation",
    detailPlaceholder:
      "Halte fest, was beobachtet oder entschieden wurde, warum es zählt und was es entkräften würde.",
    appending: "Wird angehängt…",
    append: "Journaleintrag anhängen",
    immutableNote:
      "Einträge lassen sich nicht nachträglich bearbeiten. Ergänze eine spätere Entscheidung, wenn sich die Evidenz ändert.",
  },
  journalHistory: {
    heading: "Entscheidungsjournal",
    description:
      "Die neuesten Einträge stehen oben; Sequenznummern ändern sich nie.",
    sourceRun: "Quell-Lauf: {id}",
    emptyTitle: "Noch kein Strategiejournal",
    emptyDescription:
      "Hänge eine Beobachtung, Entscheidung, Grenze oder ein Experiment an, wenn Evidenz ändert, wie das Team handeln sollte.",
  },
  revisionHistory: {
    heading: "Revisionshistorie",
    description:
      "Profilrevisionen sind unveränderlich, die neuesten stehen oben.",
  },
} as const;
