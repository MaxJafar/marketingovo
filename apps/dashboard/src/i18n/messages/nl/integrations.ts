import type { MessagesFor } from "../types";

/** Integrations page: connector cards and their credential sub-forms. */
export const integrations: MessagesFor<"integrations"> = {
  eyebrow: "Verbonden data",
  title: "Integraties",
  description:
    "Breng zoek-, analytics-, crawl- en contentsignalen samen in één verdedigbare beslislaag.",
  vaultNoticeTitle: "Credentials blijven buiten de browser",
  vaultNoticeBody:
    "Geheime waarden gaan naar de lokale API voor versleutelde opslag aan de serverkant. De UI ontvangt alleen de verbindingsstatus en veilige accountlabels.",
  testFailedTitle: "Verbindingstest mislukt",
  testCompleteTitle: "Verbindingstest voltooid",
  testCompleteBody: "De integratiestatus is ververst.",
  removedTitle: "Lokale credential verwijderd",
  removedBody:
    "De provider is losgekoppeld van Marketingovo. Niet-geheime sitekoppelingen blijven beschikbaar voor een latere herverbinding.",
  cancel: "Annuleren",
  credentialForm: {
    apiKeyLabel: "API-sleutel",
    title: "{name} verbinden",
    intro:
      "Credentials gaan rechtstreeks naar de lokale API. Dit dashboard slaat ze nooit op in browseropslag en leest ze nooit terug.",
    closeAria: "Credentialformulier sluiten",
    textHelp: "Voer de account-identifier in die het platform heeft verstrekt.",
    secretHelp:
      "Opgeslagen in de credentialkluis van de API; wordt nooit teruggegeven aan de browser.",
    notSavedTitle: "Credentials zijn niet opgeslagen",
    saving: "Veilig opslaan…",
    saveAndConnect: "Opslaan en verbinden",
    continue: "Doorgaan",
  },
  configurationForm: {
    title: "{name} configureren",
    intro:
      "Deze niet-geheime instellingen worden per site opgeslagen, zodat één lokale werkruimte meerdere sites aan verschillende providerproperty's kan koppelen.",
    closeAria: "Configuratieformulier sluiten",
    help: "Deze instelling bevat geen geheim credentialmateriaal.",
    notSavedTitle: "Configuratie is niet opgeslagen",
    saving: "Opslaan…",
    save: "Configuratie opslaan",
  },
  removal: {
    title: "Lokale toegang tot {name} intrekken",
    intro:
      "Verwijder deze credential uit de lokale kluis van het besturingssysteem en koppel hem los van elk lokaal project. Niet-geheime sitekoppelingen blijven staan voor een latere herverbinding.",
    closeAria: "Credentialverwijdering sluiten",
    providerNoticeTitle: "Toegang bij de provider kan actief blijven",
    providerNoticeBody:
      "Marketingovo kan zijn lokale kopie verwijderen, maar kan een API-sleutel of OAuth-toestemming bij de provider niet deactiveren. Gebruik de setuppagina van de provider wanneer je de credential aan de bron wilt intrekken.",
    acknowledgement:
      "Ik begrijp dat dit {name} loskoppelt in elk lokaal project.",
    notRemovedTitle: "Credential is niet verwijderd",
    removing: "Verwijderen…",
    remove: "Lokale credential verwijderen",
  },
  card: {
    categoryFallback: "Databron",
    descriptionFallback: "Er is geen integratiebeschrijving teruggegeven.",
    account: "Account",
    notConnected: "Niet verbonden",
    lastVerifiedSync: "Laatst geverifieerde sync",
    quotaRemaining: "Resterend quotum",
    quotaReset: "Quotumreset",
    rotateCredentials: "Credentials roteren",
    addOptionalApiKey: "Optionele API-sleutel toevoegen",
    connectApiKey: "API-sleutel verbinden",
    connectCredentials: "Credentials verbinden",
    connectAccount: "Account verbinden",
    reconnectAccount: "Account opnieuw verbinden",
    editSiteMapping: "Sitekoppeling bewerken",
    configureSite: "Site configureren",
    testConnection: "Verbinding testen",
    revokeAria: "Lokale toegang van {name} intrekken",
    revoke: "Lokale toegang intrekken",
  },
  emptyTitle: "Geen integraties beschikbaar",
  emptyDescription:
    "De API gaf geen integratiecatalogus terug. Controleer de systeemgezondheid en serverconfiguratie.",
} as const;
