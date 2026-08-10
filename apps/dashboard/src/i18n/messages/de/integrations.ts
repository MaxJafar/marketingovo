import type { MessagesFor } from "../types";

/** Integrations page: connector cards and their credential sub-forms. */
export const integrations: MessagesFor<"integrations"> = {
  eyebrow: "Verbundene Daten",
  title: "Integrationen",
  description:
    "Hole Such-, Analytics-, Crawling- und Content-Signale in eine belastbare Entscheidungsebene.",
  vaultNoticeTitle: "Zugangsdaten bleiben aus dem Browser raus",
  vaultNoticeBody:
    "Geheime Werte werden an die lokale API übermittelt und dort verschlüsselt serverseitig gespeichert. Die UI erhält nur den Verbindungsstatus und unbedenkliche Konto-Labels.",
  testFailedTitle: "Verbindungstest fehlgeschlagen",
  testCompleteTitle: "Verbindungstest abgeschlossen",
  testCompleteBody: "Der Integrationsstatus wurde aktualisiert.",
  removedTitle: "Lokale Zugangsdaten entfernt",
  removedBody:
    "Der Anbieter ist von Marketingovo getrennt. Nicht-geheime Site-Zuordnungen bleiben für ein späteres Neuverbinden verfügbar.",
  cancel: "Abbrechen",
  credentialForm: {
    apiKeyLabel: "API-Key",
    title: "{name} verbinden",
    intro:
      "Zugangsdaten gehen direkt an die lokale API. Dieses Dashboard legt sie nie im Browser-Speicher ab und liest sie nie zurück.",
    closeAria: "Zugangsdaten-Formular schließen",
    textHelp: "Gib die von der Plattform vergebene Konto-Kennung ein.",
    secretHelp:
      "Im Credential-Vault der API gespeichert; wird nie an den Browser zurückgegeben.",
    notSavedTitle: "Zugangsdaten wurden nicht gespeichert",
    saving: "Wird sicher gespeichert…",
    saveAndConnect: "Speichern und verbinden",
    continue: "Weiter",
  },
  configurationForm: {
    title: "{name} konfigurieren",
    intro:
      "Diese nicht-geheimen Einstellungen werden pro Site gespeichert, sodass ein lokaler Workspace mehrere Sites auf unterschiedliche Anbieter-Properties abbilden kann.",
    closeAria: "Konfigurationsformular schließen",
    help: "Diese Einstellung enthält kein geheimes Credential-Material.",
    notSavedTitle: "Konfiguration wurde nicht gespeichert",
    saving: "Wird gespeichert…",
    save: "Konfiguration speichern",
  },
  removal: {
    title: "Lokalen Zugriff auf {name} widerrufen",
    intro:
      "Löscht diese Zugangsdaten aus dem vom Betriebssystem gesicherten lokalen Vault und trennt sie von jedem lokalen Projekt. Nicht-geheime Site-Zuordnungen bleiben für ein späteres Neuverbinden bestehen.",
    closeAria: "Entfernen der Zugangsdaten schließen",
    providerNoticeTitle: "Der Zugriff beim Anbieter kann aktiv bleiben",
    providerNoticeBody:
      "Marketingovo kann seine lokale Kopie löschen, aber keinen API-Key und keine OAuth-Freigabe beim Anbieter deaktivieren. Nutze die Setup-Seite des Anbieters, wenn du die Zugangsdaten an ihrer Quelle widerrufen willst.",
    acknowledgement:
      "Mir ist klar, dass dies {name} in jedem lokalen Projekt trennt.",
    notRemovedTitle: "Zugangsdaten wurden nicht entfernt",
    removing: "Wird entfernt…",
    remove: "Lokale Zugangsdaten entfernen",
  },
  card: {
    categoryFallback: "Datenquelle",
    descriptionFallback:
      "Es wurde keine Integrationsbeschreibung zurückgegeben.",
    account: "Konto",
    notConnected: "Nicht verbunden",
    lastVerifiedSync: "Letzte verifizierte Synchronisierung",
    quotaRemaining: "Verbleibendes Kontingent",
    quotaReset: "Kontingent-Reset",
    rotateCredentials: "Zugangsdaten rotieren",
    addOptionalApiKey: "Optionalen API-Key hinzufügen",
    connectApiKey: "API-Key verbinden",
    connectCredentials: "Zugangsdaten verbinden",
    connectAccount: "Konto verbinden",
    reconnectAccount: "Konto neu verbinden",
    editSiteMapping: "Site-Zuordnung bearbeiten",
    configureSite: "Site konfigurieren",
    testConnection: "Verbindung testen",
    revokeAria: "Lokalen Zugriff von {name} widerrufen",
    revoke: "Lokalen Zugriff widerrufen",
  },
  emptyTitle: "Keine Integrationen verfügbar",
  emptyDescription:
    "Die API hat keinen Integrationskatalog zurückgegeben. Prüfe Systemzustand und Serverkonfiguration.",
} as const;
