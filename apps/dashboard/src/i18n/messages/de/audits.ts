import type { MessagesFor } from "../types";

/** The audits page: run launcher, private-site approval, crawl history. */
export const audits: MessagesFor<"audits"> = {
  eyebrow: "Crawl-Historie",
  title: "Audits",
  description:
    "Starte eine Baseline, verfolge aktive Crawls und vergleiche abgeschlossene technische Snapshots.",
  starting: "Wird gestartet…",
  runFullAudit: "Voll-Audit starten",
  privateAccess: {
    summary: "Zugriff auf private Sites",
    allowTitle:
      "Genau diesem Hostnamen für dieses Audit den Zugriff auf ein privates Netzwerk erlauben",
    allowHelp:
      "Nur {host}. Diese Freigabe gilt für Audits, die von dieser Seite gestartet werden, bis du das Projekt wechselst; Cloud-Metadaten bleiben immer blockiert.",
  },
  scope: {
    summary: "Experten-Audit-Umfang",
    title: "Eine exakte URL-Kohorte auditieren",
    body: "Füge eine absolute URL pro Zeile ein. Marketingovo crawlt nur diese Liste und behält jede URL als Seed — nützlich für Migrationen, Templates, QA-Stichproben und Verifikationsläufe.",
    urlListLabel: "URL-Liste",
    urlListHelp:
      "URLs müssen den Projekt-Origin verwenden. Fragmente und Duplikate werden vor dem Start entfernt.",
    errorTitle: "URL-Kohorte braucht Aufmerksamkeit",
    submit: "URL-Listen-Audit starten",
    atLeastOneUrl: "Füge mindestens eine absolute URL hinzu.",
    invalidUrl: "Ungültige URL: {url}",
    unsupportedScheme: "Nicht unterstütztes URL-Schema: {scheme}",
  },
  startErrorTitle: "Audit konnte nicht starten",
  queuedTitle: "Audit eingereiht",
  queuedBody:
    "Die API hat den Lauf angenommen. Aktualisiere die Seite oder beobachte den Status unten.",
  columns: {
    started: "Gestartet",
    status: "Status",
    trigger: "Auslöser",
    pagesCrawled: "Gecrawlte Seiten",
    issues: "Probleme",
    healthScore: "Health-Score",
  },
  tableLabel: "Audit-Läufe",
  emptyTitle: "Noch keine Audit-Läufe",
  emptyBody:
    "Starte ein vollständiges Baseline-Audit, um Crawl-Historie und priorisierte Maßnahmen zu befüllen.",
} as const;
