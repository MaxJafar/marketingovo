import type { MessagesFor } from "../types";

export const settings: MessagesFor<"settings"> = {
  eyebrow: "Workspace-Konfiguration",
  title: "Einstellungen",
  description:
    "Aktualisiere die Site-Identität und die Reporting-Einstellungen, die mit diesem lokalen Projekt gespeichert sind.",
  languageTitle: "Sprache",
  languageDescription:
    "Oberflächensprache dieser Konsole auf diesem Gerät. Daten, Berichte und Agenten-Oberflächen werden nicht übersetzt.",
  languageLabel: "Oberflächensprache",
  savedTitle: "Einstellungen gespeichert",
  savedBody:
    "Die lokale API hat die aktualisierten Workspace-Einstellungen angenommen.",
  notSavedTitle: "Einstellungen wurden nicht gespeichert",
  notExportedTitle: "Projekt wurde nicht exportiert",
  notImportedTitle: "Projekt wurde nicht importiert",
  importedTitle: "Projekt importiert",
  importedSummary:
    "Importiert: {runs} Läufe, {actions} Maßnahmen, {contextVersions} Kontext-Revisionen, {contextEntries} Journaleinträge, {extractionRuleVersions} Extraktionsregel-Revisionen und {artifacts} Bericht-Artefakte. Zeitpläne sind deaktiviert und {reconnect}.",
  reconnectList: "diese Integrationen müssen neu verbunden werden: {providers}",
  reconnectNone: "keine Integration muss neu verbunden werden",
  notDeletedTitle: "Projekt wurde nicht gelöscht",
  deletedTitle: "Lokales Projekt gelöscht",
  deletedSummary:
    "Entfernt: {runs} Läufe, {issueInstances} Problem-Beobachtungen, {actions} Maßnahmen, {extractionRuleVersions} Extraktionsregel-Revisionen und {artifacts} Artefakte. {cleanup} Globale Integrations-Zugangsdaten wurden für andere Projekte behalten.",
  cleanupComplete: "Dateisystembereinigung abgeschlossen.",
  cleanupScheduled:
    "Die Dateisystembereinigung ist für den nächsten Dienststart geplant.",
  siteIdentity: "Site-Identität",
  siteName: "Site-Name",
  canonicalUrl: "Kanonische URL",
  reporting: "Reporting",
  timezone: "Zeitzone",
  reportingCurrency: "Berichtswährung",
  retentionTarget: "Lokales Aufbewahrungsziel (Tage)",
  reportPreferences: "Berichtseinstellungen",
  alertEmail: "Kontakt-E-Mail für Berichte",
  alertEmailHelp:
    "Lokal als Bericht-Metadatum gespeichert. Marketingovo versendet keine gehosteten E-Mail-Alerts.",
  weeklyDigest: "Wöchentlicher Digest",
  weeklyDigestHelp:
    "Wöchentliche Prioritäten, Trends und Regressionen beim Erzeugen von Digest-Berichten einbeziehen.",
  saving: "Wird gespeichert…",
  save: "Einstellungen speichern",
  portabilityTitle: "Projekt-Portabilität",
  portabilityBodyBefore: "Exportiere ein versioniertes",
  portabilityBodyAfter:
    "Bundle mit Audit-Historie, Maßnahmen, Metriken, Projektkontext-Revisionen, dem Marketer-Journal, eigenen Regeln, Konnektor-Einstellungen und begrenzten Bericht-Artefakten. Zugangsdaten, Tokens, Cookies, Header und lokale Dateipfade sind nie enthalten.",
  exporting: "Wird exportiert…",
  exportProject: "Projekt exportieren",
  importing: "Wird importiert…",
  importProject: "Projekt importieren",
  importHelp:
    "Ein Import legt immer ein neues lokales Projekt an, mappt Bezeichner neu, bewahrt Problem-Fingerprints, Kontext, Extraktionsregeln und den Konfigurations-Snapshot hinter jedem Lauf, deaktiviert importierte Zeitpläne und verlangt, dass Integrationen neu verbunden werden.",
  dangerZone: "Gefahrenzone",
  deleteTitle: "Lokales Projekt löschen",
  deleteBody1:
    "Entfernt dieses Projekt, seine Läufe, rohe Evidenz, Maßnahmen-Historie, den Projektkontext, Extraktionsregel-Revisionen, Zeitpläne, Einstellungen und Bericht-Artefakte dauerhaft von diesem Gerät. Exportiere das Projekt vorher, falls du es noch einmal brauchen könntest.",
  deleteBody2:
    "Globale BYOK-Zugangsdaten werden bewusst behalten, weil sie anderen Projekten dienen können. Widerrufe sie separat unter Integrationen.",
  deleteProject: "Projekt löschen",
  confirmLabel: "Gib zur Bestätigung den Projektnamen ein",
  confirmHelpBefore: "Gib",
  confirmHelpAfter:
    "exakt ein. Diese Aktion kann nicht rückgängig gemacht werden.",
  cancel: "Abbrechen",
  deleting: "Wird gelöscht…",
  permanentlyDelete: "Projekt endgültig löschen",
} as const;
