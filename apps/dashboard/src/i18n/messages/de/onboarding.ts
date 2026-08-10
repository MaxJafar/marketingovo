import type { MessagesFor } from "../types";

/** Guided setup: the seven-step onboarding checklist and its cards. */
export const onboarding: MessagesFor<"onboarding"> = {
  eyebrow: "Geführtes Setup",
  title: "Erreiche deinen ersten nützlichen Insight",
  description:
    "Lege einen Workspace an, wähle Evidenz und Ziel, dann aktiviere wiederholtes Monitoring. Eine Website ist optional und schaltet Crawling und Audits frei.",
  apiUnavailableTitle: "Die lokale API ist nicht verfügbar",
  progressLabel: "Onboarding-Fortschritt",
  progressSummary: "Schritt {current} von {total}: {label}.",
  stepCompleted: "Abgeschlossen.",
  stepOptionalIncomplete: "Optional, nicht abgeschlossen.",
  stepCurrent: "Aktueller Schritt.",
  stepIncomplete: "Nicht abgeschlossen.",
  steps: {
    createWorkspace: {
      label: "Workspace anlegen",
      description: "Benenne die Marke, für die dieser Workspace ist.",
    },
    addWebsite: {
      label: "Website hinzufügen",
      description: "Optional. Nur für Crawling und SEO-Audits nötig.",
    },
    connectData: {
      label: "Daten verbinden",
      description: "Verbinde eine Quelle oder wähle die reine Crawl-Analyse.",
    },
    chooseGoal: {
      label: "Ziel wählen",
      description: "Sag dem Audit, welches Ergebnis jetzt zählt.",
    },
    runBaseline: {
      label: "Baseline starten",
      description: "Erstelle deinen ersten technischen Snapshot.",
    },
    reviewActions: {
      label: "Maßnahmen prüfen",
      description: "Wähle den wertvollsten nächsten Zug.",
    },
    activateMonitoring: {
      label: "Monitoring aktivieren",
      description: "Plane wiederholte Audits gegen Regressionen.",
    },
  },
  goals: {
    technicalHealth: {
      title: "Technischen Zustand verbessern",
      description:
        "Priorisiert Indexierbarkeit, Crawlbarkeit, Performance und Regressionen.",
    },
    qualifiedTraffic: {
      title: "Qualifizierten Traffic steigern",
      description:
        "Findet Seiten und Suchanfragen mit dem stärksten realistischen Potenzial.",
    },
    organicKeyEvents: {
      title: "Organische Key Events erhöhen",
      description:
        "Gewichtet Empfehlungen nach Analytics- und Conversion-Exposition.",
    },
    contentOpportunities: {
      title: "Content-Chancen planen",
      description:
        "Deckt Themenlücken auf und verwandelt Nachfrage in einen evidenzgestützten Plan.",
    },
  },
  loading: {
    kicker: "Lokale API wird geprüft",
    title: "Dein Workspace wird geladen…",
    body: "Das Dashboard prüft, ob bereits eine Site konfiguriert ist.",
  },
  create: {
    kicker: "Schritt 1 von 7",
    title: "Lege deinen ersten Workspace an",
    body: "Ein Workspace hält die Kanäle, Recherchen und Notizen dieser Marke. Eine Website ist optional — füge nur eine hinzu, wenn du Crawling und SEO-Audits willst.",
    notAddedTitle: "Site wurde nicht hinzugefügt",
    addedTitle: "Site hinzugefügt",
    addedBody:
      "Weiter geht es, indem du mindestens eine Quelle verbindest oder die reine Crawl-Analyse wählst.",
    nameLabel: "Workspace-Name",
    urlLabel: "Kanonische URL",
    optional: "Optional",
    urlHelp:
      "Lass das Feld leer, um zuerst an Social, Ads und Recherche zu arbeiten. Eine Website kannst du jederzeit in den Einstellungen hinzufügen.",
    creating: "Workspace wird angelegt…",
    submit: "Workspace anlegen",
  },
  workspace: {
    kicker: "Aktiver Workspace",
    noWebsite: "Keine Website — Crawling und Audits sind aus.",
  },
  evidence: {
    kicker: "Schritt 3 von 7",
    title: "Wähle deine Evidenz",
    body: "Verbinde Plattformen, denen dein Team vertraut, oder starte mit Crawl-Daten und ergänze Integrationen später. Fehlende Quellen senken die Konfidenz; sie werden nie zu falschen Nullen.",
    connectedIntegrations: "verbundene Integrationen",
    crawlOnlyTitle: "Reine Crawl-Analyse gewählt",
    crawlOnlyBody:
      "Die Baseline kann jetzt laufen. Verbinde GSC oder GA4 später, um Konfidenz und Expositions-Scoring zu verbessern.",
    manageIntegrations: "Integrationen verwalten",
    crawlOnlyButton: "Nur mit Crawl-Daten fortfahren",
  },
  goal: {
    kicker: "Schritt 4 von 7",
    title: "Wähle das Ergebnis, das jetzt zählt",
    body: "Das gewählte Ziel wird mit dem Audit-Lauf gespeichert, damit sein Zweck in Historie und Agenten-Workflows explizit bleibt.",
    groupLabel: "Primäres SEO-Ziel",
  },
  baseline: {
    kicker: "Schritt 5 von 7",
    title: "Baue die Baseline",
    body: "Ein vollständiges Audit gibt Maßnahmen Evidenz auf URL-Ebene und schafft einen Referenzpunkt fürs Monitoring.",
    needsWebsiteTitle: "Dieser Schritt braucht eine Website",
    needsWebsiteBefore: "Ein Baseline-Audit crawlt deine Site. Füge in den",
    needsWebsiteLink: "Einstellungen",
    needsWebsiteAfter:
      "eine Website hinzu, um ihn freizuschalten — oder spring weiter: der Rest dieses Workspace funktioniert auch ohne.",
    chooseGoalTitle: "Wähle zuerst ein Ziel",
    chooseGoalBody:
      "Wähle oben das Ergebnis aus, bevor du die Baseline startest.",
    notStartedTitle: "Audit konnte nicht starten",
    queuedTitle: "Audit eingereiht",
    queuedBody:
      "Verfolge den Lauf über die Audit-Historie. Maßnahmen schalten sich erst frei, wenn ein vollständiges oder teilweises Ergebnis vorliegt.",
    privateAccessSummary: "Zugriff auf private Sites",
    privateAccessLabel:
      "Genau diesem Hostnamen für dieses Audit den Zugriff auf ein privates Netzwerk erlauben",
    privateAccessHelp:
      "Nur {host}. Loopback- und private Adressen bleiben blockiert, solange du diesen Host nicht freigibst; Cloud-Metadaten bleiben immer blockiert.",
    starting: "Audit wird gestartet…",
    run: "Baseline-Audit starten",
    viewHistory: "Audit-Historie ansehen",
  },
  firstMove: {
    kicker: "Schritt 6 von 7",
    title: "Wähle den ersten Zug",
    body: "Vergleiche Impact, Aufwand, Konfidenz und Quellen-Evidenz, bevor du Ressourcen bindest. Dieser Schritt schaltet sich erst frei, wenn die Baseline ein vollständiges oder teilweises Ergebnis liefert.",
    reviewActions: "Priorisierte Maßnahmen prüfen",
    lockedReason: "Wartet auf einen abgeschlossenen Baseline-Lauf.",
  },
  monitoring: {
    kicker: "Schritt 7 von 7",
    title: "Lokales Monitoring aktivieren",
    body: "Erstellt ein dauerhaftes wöchentliches Audit, jeden Montag um 06:00 in deiner lokalen Zeitzone. Den Rhythmus kannst du unter Monitoring ändern.",
    notActivatedTitle: "Monitoring wurde nicht aktiviert",
    activatedTitle: "Monitoring aktiviert",
    activatedBody:
      "Der lokale Hintergrunddienst führt den wöchentlichen Zeitplan aus, solange er verfügbar ist.",
    activeTitle: "Monitoring ist aktiv",
    activeBody: "Mindestens ein aktivierter Zeitplan schützt diese Property.",
    activating: "Monitoring wird aktiviert…",
    activate: "Wöchentliches Monitoring aktivieren",
    manage: "Monitoring verwalten",
    lockedReason:
      "Schließe die Baseline ab und öffne die priorisierten Maßnahmen, bevor du Monitoring aktivierst.",
  },
} as const;
