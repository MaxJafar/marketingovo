import type { MessagesFor } from "../types";

/** Public-web OSINT page: pass form, dossier cards, trust, findings, history. */
export const osintResearch: MessagesFor<"osintResearch"> = {
  eyebrow: "Produktpriorität · Intelligence-Ebene",
  title: "Public-Web-OSINT",
  description:
    "Baue ein begrenztes, quellenverlinktes Dossier aus deiner Site und bis zu vier ausdrücklich angegebenen öffentlichen Zielen. Der Graph bewahrt das Beobachtete, ohne fehlende Daten in eine Behauptung zu verwandeln.",
  available: "Verfügbar",
  sourceLink: "Quelle",
  citedEvidenceOne: "{count} zitiertes Evidenzelement",
  citedEvidenceMany: "{count} zitierte Evidenzelemente",
  confidencePct: "{confidence} % Konfidenz",
  evidence: {
    confidence: "{label} · {confidence} % Konfidenz",
    observedAt: "· beobachtet {date}",
    claimLabel: "· Behauptung",
  },
  form: {
    title: "Einen Evidenz-Durchlauf starten",
    description:
      "Die Projekt-Site ist automatisch enthalten. Ergänze öffentliche Wettbewerber-, Partner-, Newsroom- oder Referenz-URLs, wenn sie in den Umfang gehören.",
    targetsLabel: "Zusätzliche öffentliche Ziele",
    targetsHelp:
      "Bis zu vier URLs, eine pro Zeile. Nur HTTPS; keine Zugangsdaten, Cookies, Konto-Abfragen oder Personensuche-Pivots.",
    queueing: "Public-Web-Recherche wird eingereiht…",
    run: "OSINT-Durchlauf starten",
    invalidTarget: "Nutze eine explizite öffentliche https://-URL: {url}",
    rejectedTitle: "Zielliste wurde nicht akzeptiert",
    failedTitle: "OSINT-Lauf konnte nicht starten",
    queuedTitle: "OSINT-Lauf eingereiht",
    queuedBody:
      "Der Lauf wird mit Public-Web-Limits gesammelt. Diese Seite aktualisiert sich, sobald sein Evidenz-Dossier gespeichert ist.",
  },
  target: {
    eyebrow: "Ziel-Dossier",
    pagesObserved: "Beobachtete Seiten",
    availableEvidence: "Verfügbare Evidenz",
    graphEntities: "Graph-Entitäten",
    graphLinks: "Graph-Verknüpfungen",
    finalUrl: "Finale URL:",
    publishingSignalTitle: "Öffentliches Publikationssignal",
    cadenceItemsOne: "{count} datiertes Element im beobachteten Feed",
    cadenceItemsMany: "{count} datierte Elemente im beobachteten Feed",
    cadenceUnavailable:
      "; ohne gemessenes Intervall ist der Rhythmus nicht verfügbar.",
    cadenceAverage: "; durchschnittliches Intervall {days} Tage.",
    cadenceDisclaimer:
      "Das ist Publikationsevidenz, nicht Reichweite oder Engagement.",
    notObservedTitle: "Ziel wurde nicht vollständig beobachtet",
  },
  coverage: {
    title: "Abdeckung und Policy",
    description:
      "Jede Beobachtung behält ihre Quelle und ihren Evidenzzustand. Ein fehlendes Signal wird nie zu null gemacht.",
    coverage: "Abdeckung",
    targetsCompleted: "Abgeschlossene Ziele",
    pagesObserved: "Beobachtete Seiten",
    evidenceAvailable: "Verfügbare Evidenz",
    publicWebOnly: "Nur öffentliches Web",
    personalDataDisabled: "Personendaten deaktiviert",
    identityResolutionDisabled: "Identitätsauflösung deaktiviert",
    authenticatedCollectionDisabled: "Authentifizierte Sammlung deaktiviert",
    darkWebDisabled: "Darkweb deaktiviert",
  },
  trust: {
    title: "Vertrauen und Provenienz",
    description:
      "Stabile Behauptungs-Fingerprints machen Wiederholungsläufe auditierbar, ohne eine Public-Web-Beobachtung als unabhängig verifizierte Wahrheit auszugeben.",
    claimFingerprints: "Behauptungs-Fingerprints",
    sourceUrlsRecorded: "Erfasste Quell-URLs",
    integrityRecord: "Integritätsnachweis",
    recorded: "Erfasst",
    incomplete: "Unvollständig",
    legacyDossier: "Altes Dossier",
    fingerprintAlgorithm: "Fingerprint-Algorithmus",
    evidenceDigest: "Evidenz-Digest:",
    olderFormatTitle: "Älteres Dossier-Format",
    olderFormatBody:
      "Dieser gespeicherte Durchlauf stammt aus der Zeit vor den Behauptungs-Fingerprints. Starte einen neuen Public-Web-Durchlauf, um Provenienz für jede Beobachtung zu erfassen.",
    fingerprintScope:
      "Fingerprints decken die beobachteten Behauptungsfelder ab und schließen den Erfassungszeitpunkt bewusst aus. Der Digest erkennt Berichtsänderungen; er bescheinigt nicht, dass eine Quelle korrekt oder maßgeblich ist.",
  },
  findings: {
    title: "Befunde",
    description:
      "Beschreibende, evidenzverlinkte Beobachtungen aus dem öffentlichen Web.",
    empty: "Kein Befund wurde von der beobachteten Evidenz gestützt.",
  },
  history: {
    title: "Durchlauf-Historie",
    comparedDescription:
      "Zitierte Public-Web-Änderungen seit {date}. Ein blockiertes Ziel wird ausgeschlossen, statt als Verschwinden behandelt zu werden.",
    firstPassDescription:
      "Starte einen zweiten Public-Web-Durchlauf, um exakte Signale über die Zeit zu vergleichen.",
    baseline:
      "Der erste Durchlauf setzt die Baseline. Spätere Durchläufe melden hinzugekommene, entfernte und geänderte Evidenz, ohne Identitätsbehauptungen aufzustellen.",
    noChanges:
      "Seit dem vorherigen Durchlauf hat sich kein gestütztes öffentliches Signal geändert.",
    targetLabel: "· Ziel",
  },
  dossiers: {
    title: "Ziel-Dossiers",
    generatedOne: "Erzeugt {date} · {count} begrenztes Quellenziel.",
    generatedMany: "Erzeugt {date} · {count} begrenzte Quellenziele.",
  },
  limitations: {
    title: "Bekannte Einschränkungen",
    description:
      "Diese Grenzen sind Teil des Dossier-Vertrags, keine versteckte Lücke in der UI.",
  },
  noDossierTitle: "Noch kein OSINT-Dossier",
  noDossierBody:
    "Starte oben einen Public-Web-Durchlauf, um das erste evidenzverlinkte Dossier für dieses Projekt zu erstellen.",
} as const;
