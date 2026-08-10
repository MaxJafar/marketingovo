import type { MessagesFor } from "../types";

export const settings: MessagesFor<"settings"> = {
  eyebrow: "Werkruimteconfiguratie",
  title: "Instellingen",
  description:
    "Werk de site-identiteit en de rapportagevoorkeuren bij die bij dit lokale project zijn opgeslagen.",
  languageTitle: "Taal",
  languageDescription:
    "Interfacetaal voor deze console op dit apparaat. Data, rapporten en agentoppervlakken worden niet vertaald.",
  languageLabel: "Interfacetaal",
  savedTitle: "Instellingen opgeslagen",
  savedBody:
    "De lokale API heeft de bijgewerkte werkruimte-instellingen geaccepteerd.",
  notSavedTitle: "Instellingen zijn niet opgeslagen",
  notExportedTitle: "Project is niet geëxporteerd",
  notImportedTitle: "Project is niet geïmporteerd",
  importedTitle: "Project geïmporteerd",
  importedSummary:
    "Geïmporteerd: {runs} runs, {actions} acties, {contextVersions} contextrevisies, {contextEntries} journaalitems, {extractionRuleVersions} extractieregelrevisies en {artifacts} rapportartefacten. Schema's staan uit en {reconnect}.",
  reconnectList:
    "deze integraties moeten opnieuw worden verbonden: {providers}",
  reconnectNone: "er hoeft geen integratie opnieuw te worden verbonden",
  notDeletedTitle: "Project is niet verwijderd",
  deletedTitle: "Lokaal project verwijderd",
  deletedSummary:
    "Verwijderd: {runs} runs, {issueInstances} issuewaarnemingen, {actions} acties, {extractionRuleVersions} extractieregelrevisies en {artifacts} artefacten. {cleanup} Globale integratiecredentials zijn bewaard voor andere projecten.",
  cleanupComplete: "Bestandssysteemopruiming voltooid.",
  cleanupScheduled:
    "Bestandssysteemopruiming staat gepland voor de volgende servicestart.",
  siteIdentity: "Site-identiteit",
  siteName: "Sitenaam",
  canonicalUrl: "Canonieke URL",
  reporting: "Rapportage",
  timezone: "Tijdzone",
  reportingCurrency: "Rapportagevaluta",
  retentionTarget: "Lokaal bewaardoel (dagen)",
  reportPreferences: "Rapportvoorkeuren",
  alertEmail: "Contact-e-mail voor rapporten",
  alertEmailHelp:
    "Lokaal opgeslagen als rapportmetadata. Marketingovo verstuurt geen gehoste e-mailalerts.",
  weeklyDigest: "Voorkeur wekelijkse digest",
  weeklyDigestHelp:
    "Neem wekelijkse prioriteiten, trends en regressies mee bij het genereren van digestrapporten.",
  saving: "Opslaan…",
  save: "Instellingen opslaan",
  portabilityTitle: "Projectportabiliteit",
  portabilityBodyBefore: "Exporteer een geversioneerde",
  portabilityBodyAfter:
    "bundel met audithistorie, acties, metrics, Projectcontext-revisies, het marketeersjournaal, aangepaste regels, connectorinstellingen en begrensde rapportartefacten. Credentials, tokens, cookies, headers en lokale bestandspaden gaan er nooit in mee.",
  exporting: "Exporteren…",
  exportProject: "Project exporteren",
  importing: "Importeren…",
  importProject: "Project importeren",
  importHelp:
    "Imports maken altijd een nieuw lokaal project aan, wijzen identifiers opnieuw toe, behouden issuevingerafdrukken, context, extractieregels en de configuratiesnapshot achter elke run, schakelen geïmporteerde schema's uit en vereisen dat integraties opnieuw worden verbonden.",
  dangerZone: "Gevarenzone",
  deleteTitle: "Lokaal project verwijderen",
  deleteBody1:
    "Verwijder dit project permanent van dit apparaat, met zijn runs, ruwe bewijs, actiehistorie, Projectcontext, extractieregelrevisies, schema's, instellingen en rapportartefacten. Exporteer het project eerst als je het misschien nog nodig hebt.",
  deleteBody2:
    "Globale BYOK-credentials worden bewust bewaard omdat ze andere projecten kunnen dienen. Trek ze apart in via Integraties.",
  deleteProject: "Project verwijderen",
  confirmLabel: "Typ de projectnaam ter bevestiging",
  confirmHelpBefore: "Voer",
  confirmHelpAfter: "exact in. Deze actie kan niet ongedaan worden gemaakt.",
  cancel: "Annuleren",
  deleting: "Verwijderen…",
  permanentlyDelete: "Project permanent verwijderen",
} as const;
