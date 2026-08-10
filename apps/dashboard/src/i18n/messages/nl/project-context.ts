import type { MessagesFor } from "../types";

/** Project context page: versioned profile, journal, and revision history. */
export const projectContext: MessagesFor<"projectContext"> = {
  eyebrow: "Herbruikbaar strategiegeheugen",
  title: "Projectcontext",
  description:
    "Bewaar bedrijfsdoelen, doelgroepen, markten, beperkingen en beslissingen naast crawlbewijs, zodat elk mens en elke agent vanuit dezelfde feiten start.",
  revisionSavedTitle: "Contextrevisie opgeslagen",
  revisionSavedBody:
    "De vorige revisie blijft onveranderlijk en beschikbaar in de historie.",
  revisionNotSavedTitle: "Context is niet opgeslagen",
  journalAppendedTitle: "Journaalitem toegevoegd",
  journalAppendedBody:
    "Het item is onveranderlijk en nu beschikbaar voor lokale agentresources.",
  journalNotAppendedTitle: "Journaalitem is niet toegevoegd",
  revisionLabel: "Revisie {revision}",
  profile: {
    eyebrow: "Geversioneerd profiel",
    createFirstRevision: "Maak de eerste revisie",
    savedAt: "Opgeslagen {date}",
    summaryLabel: "Samenvatting van bedrijf en zoekopdracht",
    summaryPlaceholder:
      "Wat biedt het bedrijf, aan wie, en wat moet organisch zoeken nu opleveren?",
    oneItemPerLine: "Eén item per regel.",
    changeSummaryLabel: "Revisiesamenvatting",
    changeSummaryPlaceholder:
      "VK-markt toegevoegd en demo-conversie verduidelijkt",
    changeSummaryHelp:
      "Leg uit wat er veranderde. Opslaan maakt altijd een nieuwe onveranderlijke revisie.",
    saving: "Revisie opslaan…",
    save: "Nieuwe revisie opslaan",
  },
  profileLists: {
    audiences: {
      label: "Prioritaire doelgroepen",
      help: "Wie moet deze site vinden, vertrouwen en ernaar handelen?",
      placeholder: "Technische SEO-leads\nB2B-groeiteams",
    },
    markets: {
      label: "Markten",
      help: "Landen, regio's of commerciële segmenten die de intentie veranderen.",
      placeholder: "Nederland\nBelgië",
    },
    languages: {
      label: "Talen",
      help: "Gebruik de labels die je team herkent; vermeld de locale waar relevant.",
      placeholder: "Nederlands (nl-NL)\nEngels (en-US)",
    },
    conversionGoals: {
      label: "Conversiedoelen",
      help: "Benoem de gebeurtenissen die organisch werk waardevol maken.",
      placeholder: "Gekwalificeerde demo-aanvraag\nTrialactivatie",
    },
    priorityTopics: {
      label: "Prioritaire onderwerpen",
      help: "Producten, problemen of thema's die de huidige strategie moet ondersteunen.",
      placeholder: "Technische SEO-automatisering\nLocal-first analytics",
    },
    competitors: {
      label: "Bekende concurrenten",
      help: "Merken of domeinen voor een eerlijke, expliciete vergelijking.",
      placeholder: "voorbeeld-concurrent.nl\nAlternatieve categorieleider",
    },
    constraints: {
      label: "Beperkingen en vangrails",
      help: "Juridische, merk-, platform-, migratie- of capaciteitslimieten.",
      placeholder:
        "Checkout-URL's niet wijzigen\nJuridische review vereist voor claims",
    },
  },
  journalKinds: {
    observation: "Waarneming",
    decision: "Beslissing",
    constraint: "Beperking",
    experiment: "Experiment",
  },
  journalForm: {
    eyebrow: "Alleen-toevoegen-journaal",
    heading: "Leg vast wat de strategie veranderde",
    kindLabel: "Type item",
    sourceLabel: "Bronaudit (optioneel)",
    noLinkedAudit: "Geen gekoppelde audit",
    titleLabel: "Titel van het item",
    titlePlaceholder:
      "VK-vergelijkingspagina's converteren gekwalificeerde demo's",
    detailLabel: "Bewijs en implicatie",
    detailPlaceholder:
      "Beschrijf wat is waargenomen of besloten, waarom het ertoe doet en wat het zou ontkrachten.",
    appending: "Toevoegen…",
    append: "Journaalitem toevoegen",
    immutableNote:
      "Items kunnen niet ter plekke worden bewerkt. Voeg een latere beslissing toe wanneer het bewijs verandert.",
  },
  journalHistory: {
    heading: "Beslissingsjournaal",
    description: "Nieuwste items staan bovenaan; volgnummers veranderen nooit.",
    sourceRun: "Bronrun: {id}",
    emptyTitle: "Nog geen strategiejournaal",
    emptyDescription:
      "Voeg een waarneming, beslissing, beperking of experiment toe wanneer bewijs verandert hoe het team moet handelen.",
  },
  revisionHistory: {
    heading: "Revisiehistorie",
    description:
      "Profielrevisies zijn onveranderlijk en staan van nieuw naar oud.",
  },
} as const;
