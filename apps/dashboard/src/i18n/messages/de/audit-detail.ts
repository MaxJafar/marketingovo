import type { MessagesFor } from "../types";

/** The audit run page: replay, sitemap coverage, and the evidence workbench. */
export const auditDetail: MessagesFor<"auditDetail"> = {
  backToAudits: "Zurück zu den Audits",
  eyebrow: "Audit-Lauf",
  runTitle: "Lauf {id}",
  fallbackTitle: "Audit-Details",
  description:
    "Prüfe Quellenabdeckung und exakte Evidenz oder wiederhole die gespeicherte Laufkonfiguration gegen den aktuellen Zustand der Site.",
  queuingReplay: "Replay wird eingereiht…",
  replayConfiguration: "Konfiguration wiederholen",
  replayErrorTitle: "Replay konnte nicht starten",
  replayQueuedTitle: "Unabhängiges Replay eingereiht",
  replayQueuedBefore:
    "Die gespeicherte Konfiguration v{version} wurde kopiert, ohne diesen Lauf zu verändern. Das Replay liest den aktuellen Zustand der Site und der Anbieter.",
  replayQueuedLink: "Replay öffnen",
  replayQueuedAfter: ".",
  boundaryTitle: "Replay-Grenze",
  boundaryBody:
    "Ein Replay erstellt aus diesem gespeicherten Workflow und seinen exakten Optionen einen neuen Lauf. Es bearbeitet dieses Ergebnis nie; Live-Seiten und Integrationen werden erneut abgefragt, damit Änderungen messbar bleiben.",
  summary: {
    status: "Status",
    started: "Gestartet",
    completed: "Abgeschlossen",
    issueInstances: "Problem-Instanzen",
  },
  breakdownTitle: "Problem-Aufschlüsselung",
  breakdownEmptyTitle: "Aufschlüsselung nicht verfügbar",
  breakdownEmptyBody:
    "Der Lauf hat keine Summen nach Schweregrad zurückgegeben.",
  runLogTitle: "Lauf-Log",
  runLogEmptyTitle: "Keine Log-Einträge",
  runLogEmptyBody: "Die API hat kein Lauf-Log zurückgegeben.",
  sitemap: {
    eyebrow: "Erfasste Quelle",
    title: "Sitemap-Abdeckung",
    description:
      "Die Abdeckung vergleicht erfasste indexierbare Crawl-URLs mit dem Sitemap-Snapshot, den genau dieser Lauf verwendet hat.",
    declaredUrls: "Deklarierte URLs",
    indexableDiscovered: "Indexierbar entdeckt",
    matched: "Übereinstimmend",
    coverage: "Abdeckung",
    snapshotBefore: "Snapshot:",
    httpStatusSuffix: " · HTTP {status}",
    filesLabel: "Erfasste Sitemap-Dateien",
    fileColumn: "Sitemap-Datei",
    typeColumn: "Typ",
    httpColumn: "HTTP",
    locationsColumn: "Einträge",
    missingIndexable: "Indexierbar, aber nicht enthalten",
    declaredNotCrawled: "Deklariert, aber nicht gecrawlt",
    brokenDeclared: "Deklarierte HTTP-Fehler",
    sampleUnavailable:
      "Nicht verfügbar, weil kein verifizierter Sitemap-Snapshot erfasst wurde.",
    sampleTruncated:
      "Angezeigt werden die ersten {shown} von {total} URLs. Der JSON-Bericht bewahrt die vollständige erfasste Kohorte.",
  },
  tabs: {
    crawl: {
      label: "Crawl-Pfade",
      description: "Kürzester erfasster Entdeckungspfad und erster Referrer.",
    },
    redirects: {
      label: "Redirects",
      description:
        "Angeforderte URL, jeder Redirect-Sprung und die finale Antwort.",
    },
    hreflang: {
      label: "Hreflang",
      description: "Sprachziele, Selbstreferenzen und wechselseitige Evidenz.",
    },
    extractions: {
      label: "Extraktionen",
      description:
        "Eigene Felder, erfasst durch die konfigurierten Extraktionsregeln.",
    },
  },
  crawl: {
    tableLabel: "Crawl-Pfad-Evidenz",
    pageColumn: "Seite",
    depthColumn: "Tiefe",
    referrerColumn: "Erster Referrer",
    httpColumn: "HTTP",
    indexableColumn: "Indexierbar",
    seed: "Seed",
  },
  redirects: {
    tableLabel: "Redirect-Pfad-Evidenz",
    requestedColumn: "Angeforderte URL",
    pathColumn: "Erfasster Pfad",
    hopsColumn: "Sprünge",
    finalHttpColumn: "Finales HTTP",
  },
  hreflang: {
    tableLabel: "Hreflang-Evidenzmatrix",
    sourceColumn: "Quellseite",
    languageColumn: "HTML- / Eigensprache",
    alternateColumn: "Alternate",
    targetColumn: "Ziel",
    reciprocalColumn: "Wechselseitig",
    missing: "Fehlt",
    selfReference: "Selbstreferenz",
    mismatch: "Erwartet {expected}; beobachtet {observed}",
    sourceFallback: "Quelle",
    noneFallback: "keine",
  },
  extractions: {
    tableLabel: "Evidenz eigener Extraktionen",
    pageColumn: "Seite",
    fieldsColumn: "Erfasste Felder",
    noMatch: "Kein Treffer",
    truncatedSuffix: " (gekürzt)",
  },
  workbench: {
    eyebrow: "Versionierte Audit-Evidenz",
    title: "Evidenz-Workbench",
    description:
      "Die UI paginiert gespeicherte Evidenz; sie kürzt eine Kohorte nie, ohne die Gesamtzahl zu zeigen.",
    tablistLabel: "Evidenz-Abschnitte",
    searchLabel: "Evidenz nach Seiten-URL oder Titel durchsuchen",
    searchPlaceholder: "Seiten-URL oder Titel suchen",
    search: "Suchen",
    clear: "Leeren",
    paginationLabel: "Evidenz-Seiten",
    previous: "Zurück",
    next: "Weiter",
    pageIndicator: "Seite {page} von {pages} · {records} Einträge",
  },
  emptyTitle: "Keine {section} erfasst",
  emptyUnavailable:
    "Dieser Lauf enthält keine versionierte Seiten-Evidenz. Starte ein neues Audit, um die Workbench zu befüllen.",
  emptyFiltered:
    "Der gewählte Lauf hat keine passenden {section}. Das ist ein gemessener Leerzustand, keine fehlgeschlagene Abfrage.",
  fallbackEvidence: "Evidenz",
  fallbackRecords: "Einträge",
} as const;
