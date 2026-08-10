import type { MessagesFor } from "../types";

/** Issue review: filters, the evidence table, and the adjudication editor. */
export const issues: MessagesFor<"issues"> = {
  eyebrow: "Qualitätskontrolle",
  title: "Problem-Review",
  description:
    "Prüfe Crawl-Evidenz, dokumentiere bewusste Ausnahmen und halte False Positives aus künftigen Prioritäten heraus, ohne Audit-Historie zu löschen.",
  filters: {
    title: "Signal von akzeptiertem Verhalten trennen",
    description:
      "Durchsuche Titel, Regeln, Module, Fingerprints und kanonische URLs. Entscheidungen gelten für die ausgewählte Site.",
    reset: "Filter zurücksetzen",
    searchLabel: "Probleme durchsuchen",
    searchPlaceholder: "Regel, URL, Titel, Fingerprint…",
    status: "Status",
    allStatuses: "Alle Status",
    statusOpen: "Offen",
    statusResolved: "Durch Audit gelöst",
    statusIgnored: "Bewusst ignoriert",
    statusFalsePositive: "False Positives",
    severity: "Schweregrad",
    allSeverities: "Alle Schweregrade",
    severityCritical: "Kritisch",
    severityHigh: "Hoch",
    severityMedium: "Mittel",
    severityLow: "Niedrig",
    severityInfo: "Info",
  },
  showingRange: "{start}–{end} von {total} Problemen angezeigt",
  tableLabel:
    "SEO-Probleme mit ausstehender oder getroffener Review-Entscheidung",
  columns: {
    severity: "Schweregrad",
    issue: "Problem",
    url: "URL",
    status: "Status",
    occurrences: "Vorkommen",
    lastSeen: "Zuletzt gesehen",
    review: "Review",
  },
  siteWide: "Seitenweit",
  /** Keyed by the API's `IssueStatus` enum; fall back to the raw value. */
  statusLabel: {
    open: "offen",
    resolved: "gelöst",
    ignored: "ignoriert",
    false_positive: "False Positive",
  },
  hide: "Ausblenden",
  review: "Review",
  paginationLabel: "Problem-Seiten",
  previous: "Zurück",
  next: "Weiter",
  pageOf: "Seite {page} von {total}",
  emptyFilteredTitle: "Keine Probleme passen",
  emptyFilteredBody:
    "Erweitere die Filter oder suche nach einer anderen Regel, einem Modul, Titel oder einer URL.",
  emptyOpenTitle: "Keine offenen Probleme",
  emptyOpenBody:
    "Starte ein Audit, um Problem-Evidenz zu sammeln, oder stelle den Statusfilter um, um gelöste Befunde zu prüfen.",
  editor: {
    eyebrow: "Evidenz-Review",
    close: "Review schließen",
    rule: "Regel",
    module: "Modul",
    firstSeen: "Zuerst gesehen",
    occurrences: "Vorkommen",
    evidenceTitle: "Erfasste Evidenz",
    structuredEvidence: "Strukturierte Evidenz",
    noEvidence:
      "Dieser Befund hat keine strukturierte Evidenz-Payload. Prüfe Regel, URL und Audit-Historie, bevor du ihn klassifizierst.",
    decision: "Review-Entscheidung",
    keepTitle: "Umsetzbar behalten",
    keepBody:
      "Entfernt jede manuelle Übersteuerung und bewertet künftige Läufe normal.",
    ignoreTitle: "Bewusst ignorieren",
    ignoreBody:
      "Das Verhalten ist real, verstanden und für diese Site akzeptiert.",
    falsePositiveTitle: "Als False Positive markieren",
    falsePositiveBody:
      "Die Regel beschreibt diese Seite oder Implementierung nicht korrekt.",
    reasonLabel: "Review-Begründung",
    reasonRequired: "(erforderlich)",
    reasonOptional: "(optional)",
    reasonPlaceholder:
      "Erkläre den Site-Kontext, damit ein anderer Marketer diese Entscheidung später nachvollziehen kann.",
    charCount: "{count} / 2.000 Zeichen",
    confirmation:
      "Ich habe die Evidenz geprüft. Diese Klassifizierung bei künftigen Audits behalten, bis jemand sie wieder öffnet.",
    saved:
      "Review gespeichert. Maßnahmen und Überblick-Prioritäten wurden aktualisiert.",
    saving: "Wird gespeichert…",
    save: "Review speichern",
    retention: "Rohe Audit-Evidenz und Historie werden nie gelöscht.",
  },
} as const;
