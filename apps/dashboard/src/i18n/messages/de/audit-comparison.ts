import type { MessagesFor } from "../types";

/** The audit comparison card: run pair selection and the evidence delta. */
export const auditComparison: MessagesFor<"auditComparison"> = {
  eyebrow: "Snapshot-Intelligenz",
  title: "Audit-Läufe vergleichen",
  description:
    "Trenne Regressionen von verifizierten Fixes anhand unveränderlicher Problem- und Seiten-Evidenz. Es wird kein neuer Crawl gestartet.",
  state: {
    comparable: "Vergleichbar",
    partial: "Teilweise Evidenz",
    unavailable: "Seiten-Evidenz nicht verfügbar",
  },
  emptyTitle: "Zwei abgeschlossene Audits sind erforderlich",
  emptyBody:
    "Starte ein Baseline- und ein Folge-Audit. Keyword-, Content- und Wettbewerber-Researchläufe zählen nicht zur technischen Historie.",
  baselineAudit: "Baseline-Audit",
  currentAudit: "Aktuelles Audit",
  openBaselineEvidence: "Baseline-Evidenz öffnen",
  openCurrentEvidence: "Aktuelle Evidenz öffnen",
  loading: "Evidenz-Delta wird berechnet…",
  errorTitle: "Vergleich nicht verfügbar",
  regressionPressure: "Regressionsdruck",
  scoreExplainer:
    "Neue Probleme addieren Schweregewicht (kritisch 8, hoch 5, mittel 3, niedrig 1); Fixes ziehen es ab. HTTP-Regressionen addieren 3, Indexierbarkeits-Regressionen 2. Negativ bedeutet Netto-Verbesserung.",
  summary: {
    newWorse: "Neue / verschlechterte Probleme",
    resolvedReduced: "Gelöst / reduziert",
    healthChange: "SEO-Health-Veränderung",
    pageRegressions: "Seiten-Regressionen",
    pagesCaptured: "Erfasste Seiten",
    reviewedExcluded: "Geprüftes Rauschen ausgeschlossen",
  },
  configuration: "Konfiguration",
  configMatched:
    "Die gespeicherten Crawl-Einstellungen stimmen in beiden Snapshots überein.",
  configDifferent: "Unterschiedliche Eingaben: {differences}.",
  configUnavailable:
    "Die gespeicherten Einstellungen sind nicht verfügbar, daher lässt sich die Gleichwertigkeit des Umfangs nicht belegen.",
  configFingerprints: "Config-Fingerprints: {baseline}… → {current}…",
  warningsTitle: "Hinweise zur Interpretation",
  columns: {
    finding: "Befund",
    change: "Änderung",
    url: "URL",
    before: "Vorher",
    after: "Nachher",
    source: "Quelle",
    target: "Ziel",
    beforeAfter: "Vorher → nachher",
  },
  regressions: {
    title: "Problem-Regressionen",
    description: "Neue Befunde und Befunde, deren Schweregrad gestiegen ist.",
    caption: "Neue und verschlechterte SEO-Probleme",
    empty:
      "Es wurden keine neuen oder verschlechterten effektiven Probleme erkannt.",
  },
  fixes: {
    title: "Verifizierte Fixes",
    description:
      "Befunde, die im aktuellen Snapshot fehlen oder reduziert sind.",
    caption: "Gelöste und reduzierte SEO-Probleme",
    empty: "In diesem Paar wurde keine Problemlösung verifiziert.",
  },
  pages: {
    title: "Seitenänderungen",
    description: "Status, Indexierbarkeit, Zugänge und Abgänge.",
    caption: "Änderungen auf Seitenebene zwischen Audit-Snapshots",
    empty: "Für dieses Paar wurden keine Änderungen auf Seitenebene erfasst.",
  },
  links: {
    title: "Änderungen interner Links",
    description:
      "Exakte Quelle-zu-Ziel-Kanten aus unveränderlichen Crawl-Graphen. Entstehung und Behebung defekter Links werden klassifiziert; redaktionelle Struktur bleibt neutral.",
    graphCoverage: "Graphabdeckung",
    edgesCaptured: "Erfasste Kanten",
    addedRemoved: "Hinzugefügt / entfernt",
    modified: "Geändert",
    regressionsRecoveries: "Regressionen / Behebungen",
    warningsTitle: "Hinweise zum Linkvergleich",
    caption: "Änderungen interner Links zwischen Audit-Snapshots",
    emptyUnavailable:
      "Wiederhole beide Audits, um vergleichbare Evidenz interner Links zu erfassen.",
    empty:
      "Für dieses Paar wurden keine Änderungen an internen Link-Kanten erfasst.",
  },
  siteWide: "Seitenweit",
  notInSnapshot: "Nicht im Snapshot",
  indexabilityUnknown: "Indexierbarkeit unbekannt",
  indexable: "indexierbar",
  notIndexable: "nicht indexierbar",
  statusUnavailable: "Status nicht verfügbar",
  notPresent: "Nicht vorhanden",
  occurrenceOne: "{count} Vorkommen",
  occurrenceOther: "{count} Vorkommen",
  truncationNotice:
    "Die API-Antwort hat ein Sicherheitslimit erreicht. Exportiere die Laufdaten oder nutze das SDK für den vollständigen gespeicherten Korpus.",
} as const;
