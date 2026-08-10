import type { MessagesFor } from "../types";

/** The email builder: brand kit, templates, compiler report, and preview. */
export const emailBuilder: MessagesFor<"emailBuilder"> = {
  report: {
    title: "Wat e-mailclients ermee gaan doen",
    okSummary: "Niets blokkerends of kapots. {size}KB gecompileerd",
    okNoWarnings: ".",
    okWarningSingular: ", met {count} waarschuwing die het lezen waard is.",
    okWarningPlural: ", met {count} waarschuwingen die het lezen waard zijn.",
    blockingRemoved:
      "{count} onderdeel/onderdelen zijn verwijderd uit wat je hebt ingediend, dus het document dat je hebt is niet het document dat je schreef. ",
    errorSingular:
      "{count} fout zal in minstens één e-mailclient zichtbaar kapotgaan.",
    errorPlural:
      "{count} fouten zullen in minstens één e-mailclient zichtbaar kapotgaan.",
  },
  brandKit: {
    title: "Brand kit",
    revisionMark: "revisie {revision}",
    notSetUp: "niet ingesteld",
    intro:
      "Waar een agent e-mails tegen schrijft, en waar de compiler het resultaat op controleert. Het postadres en de uitschrijftag zijn geen styling: commerciële e-mail is wettelijk verplicht beide te dragen.",
    colours: "Kleuren",
    colourNameLabel: "Naam kleur {number}",
    colourValueLabel: "Waarde kleur {number}",
    noStatedUse: "geen opgegeven gebruik",
    type: "Typografie",
    fontStackLabel: "Fontstack {role}",
    fontStackHelp:
      "Eindig elke stack met een generieke familie. Outlook en de mobiele apps van Gmail negeren webfonts, en zonder terugvaloptie kiezen ze hun eigen standaard.",
    legalFooter: "Juridische footer",
    companyName: "Bedrijfsnaam",
    postalAddress: "Postadres",
    unsubscribeLabel: "Uitschrijf-mergetag",
    unsubHelpBefore:
      "De uitschrijftag is wat jouw e-maildienst invult — Mailchimp gebruikt",
    unsubHelpMiddle: ", de meeste andere gebruiken een",
    unsubHelpAfter:
      "vorm. Letterlijk opgeslagen, want gokken levert een dode link op een wettelijk verplichte plek op.",
    voice: "Tone of voice",
    voicePlaceholder:
      "Hoe het merk klinkt. Gelezen door de agent die de copy schrijft.",
    voiceLabel: "Merkstem",
    changeSummaryPlaceholder: "Wat er veranderde, en waarom",
    changeSummaryLabel: "Wijzigingssamenvatting",
    saveRevision: "Revisie opslaan",
    revisionNote:
      "Elke keer opslaan voegt een revisie toe. Een e-mail van vorig kwartaal kan nog steeds zeggen tegen welk merk hij is gebouwd.",
  },
  templates: {
    title: "Templates",
    newNameLabel: "Naam nieuw template",
    create: "Aanmaken",
    empty:
      "Nog geen templates. Maak er een en schrijf hier de HTML, of vraag een gekoppelde agent een opzet te maken tegen je brand kit.",
    noRevisions: "nog geen revisies",
    revisionMeta: "revisie {revision} · bijgewerkt {time}",
  },
  compose: {
    title: "Opstellen",
    starterTitle:
      "Een op tabellen gebouwd document, al opgezet vanuit je brand kit, dat elke controle doorstaat.",
    starter: "Start vanuit de brand kit",
    checking: "Controleren…",
    check: "Controleren",
    saveRevision: "Revisie opslaan",
    subject: "Onderwerp",
    preheaderPlaceholder:
      "Preheader — de regel die de inbox na het onderwerp toont",
    preheaderLabel: "Preheader",
    emailHtml: "E-mail-HTML",
    compileFailed: "De e-mail kon niet worden gecompileerd.",
  },
  preview: {
    title: "Voorbeeld",
    desktop: "Desktop",
    mobile: "Mobiel",
    frameTitle: "E-mailvoorbeeld",
    compiledSummary: "Gecompileerde HTML — dit is wat je exporteert",
    plainTextSummary: "Platte-tekstalternatief",
    exportNote:
      "Marketingovo verstuurt geen e-mail. Kopieer de gecompileerde HTML naar je eigen e-maildienst, die je lijst, je toestemmingsregistratie en je uitschrijfafhandeling al beheert.",
  },
} as const;
