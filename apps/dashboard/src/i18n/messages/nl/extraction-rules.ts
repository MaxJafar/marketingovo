import type { MessagesFor } from "../types";

/** Custom extraction rules card: editor, template library, safe live preview. */
export const extractionRules: MessagesFor<"extractionRules"> = {
  eyebrow: "Bewijsconfiguratie",
  title: "Aangepaste extractieregels",
  description:
    "Leg prijzen, auteurs, product-ID's, CMS-markers of elk ander paginaveld vast bij elke audit. Regels horen bij dit project en elke opgeslagen revisie blijft beschikbaar voor reproduceerbare replays.",
  currentRuleSet: "Huidige regelset",
  revisionLabel: "Revisie {revision}",
  loadingRules: "Extractieregels laden…",
  preparingEditor: "Extractie-editor voorbereiden…",
  rulesUnavailableTitle: "Extractieregels niet beschikbaar",
  revisionSavedTitle: "Regelrevisie opgeslagen",
  revisionSavedBody:
    "Nieuwe audits nemen een snapshot van deze revisie. Bestaande runs en hun bewijs blijven onveranderd.",
  revisionRejectedTitle: "Regelrevisie is afgewezen",
  captureOptions: {
    text: "Tekstinhoud",
    html: "Inner HTML",
    attribute: "Attribuut",
  },
  template: {
    eyebrow: "Bibliotheek met verplichte review",
    title: "Extractietemplates",
    description:
      "Begin met een samengesteld bewijspakket, inspecteer elke selector en voeg het dan toe aan het niet-opgeslagen concept. Templates schrijven nooit zelf een revisie en starten nooit zelf een crawl.",
    policyPill: "Review vereist",
    loading: "Extractietemplates laden…",
    catalogUnavailableTitle: "Templatecatalogus niet beschikbaar",
    gridLabel: "Templates",
    review: "{name} reviewen",
    fieldsCount: "{count} velden",
    addedTitle: "Template aan concept toegevoegd",
    addedBody:
      "De velden van {name} staan hieronder klaar voor review of voorbeeld. Er wordt niets bewaard totdat je een revisiesamenvatting opgeeft en Revisie opslaan kiest.",
    reviewEyebrow: "Review van conceptimport",
    closeReview: "Review sluiten",
    previewOn: "Voorbeeld op",
    beforeSaving: "Voor het opslaan",
    beforeSavingBody:
      "Bekijk een representatieve URL en verwijder of hernoem velden die niet bij deze site passen.",
    assumptionsLabel: "Aannames om te verifiëren",
    fieldsTable: "Velden van {name}",
    fieldColumn: "Veld",
    selectorColumn: "CSS-selector",
    captureColumn: "Vastleggen",
    attributeCapture: "Attribuut: {attribute}",
    conflictTitle: "Veldconflicten oplossen",
    conflictBodyOne:
      "Hernoem of verwijder het bestaande conceptveld: {labels}. Templatelabels moeten uniek blijven.",
    conflictBodyMany:
      "Hernoem of verwijder de bestaande conceptvelden: {labels}. Templatelabels moeten uniek blijven.",
    capacityTitle: "Regellimiet overschreden",
    capacityBody:
      "Dit pakket zou de projectgrens van 50 regels overschrijden. Verwijder conceptregels voordat je het importeert.",
    addFieldsOne: "{count} veld aan concept toevoegen",
    addFieldsMany: "{count} velden aan concept toevoegen",
    freshIdsNote:
      "Nieuwe regel-ID's worden lokaal aangemaakt; catalogus-ID's worden nooit bewaard alsof ze configuratie van de gebruiker waren.",
  },
  editor: {
    listLabel: "Extractieregels",
    empty:
      "Nog geen regels. Voeg er een toe om paginaspecifieke data om te zetten in auditeerbaar bewijs.",
    ruleLegend: "Regel {number}",
    enabled: "Ingeschakeld",
    removeRule: "Regel {number} verwijderen",
    remove: "Verwijderen",
    fieldLabel: "Veldlabel",
    capture: "Vastleggen",
    cssSelector: "CSS-selector",
    attributeName: "Attribuutnaam",
    regexLabel: "Veilig regexfilter",
    regexOptional: "(optioneel)",
    regexHelp:
      "Capture-groep 1 wordt gebruikt als die er is. Backreferences, lookarounds en dubbelzinnige herhaling worden afgewezen.",
    addRule: "Regel toevoegen",
    revisionSummary: "Revisiesamenvatting",
    savingRevision: "Revisie opslaan…",
    saveRevision: "Revisie opslaan",
  },
  preview: {
    title: "Veilig live voorbeeld",
    description:
      "Haal één URL op de exacte origin van het project op, via hetzelfde redirect-bewuste uitgaande beleid dat audits gebruiken. Conceptregels worden nooit opgeslagen door ze te previewen.",
    failedTitle: "Voorbeeld mislukt",
    pageUrl: "Pagina-URL",
    rendering: "Rendering",
    renderOptions: {
      static: "Statische HTML",
      js: "JavaScript",
    },
    allowPrivateHost: "Sta precies deze privéhost toe",
    allowPrivateHostHelp:
      "Alleen nodig voor localhost of een goedgekeurde interne site. Cloudmetadata-adressen blijven geblokkeerd.",
    renderingPreview: "Voorbeeld renderen…",
    previewDraft: "Concept previewen",
    httpStatus: "HTTP {status}",
    responseTime: "{ms} ms",
    finalUrl: "Uiteindelijke URL",
    resultsTable: "Resultaten extractievoorbeeld",
    fieldColumn: "Veld",
    resultColumn: "Resultaat",
    noMatch: "Geen match",
    truncated: "Waarde afgekapt op de bewijsgrens.",
  },
} as const;
