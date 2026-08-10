import type { MessagesFor } from "../types";

/** Guided setup: the seven-step onboarding checklist and its cards. */
export const onboarding: MessagesFor<"onboarding"> = {
  eyebrow: "Begeleide setup",
  title: "Bereik je eerste bruikbare inzicht",
  description:
    "Maak een werkruimte, kies het bewijs en het doel, en activeer daarna herhaalde monitoring. Een website is optioneel en ontgrendelt crawling en audits.",
  apiUnavailableTitle: "De lokale API is niet beschikbaar",
  progressLabel: "Onboardingvoortgang",
  progressSummary: "Stap {current} van {total}: {label}.",
  stepCompleted: "Voltooid.",
  stepOptionalIncomplete: "Optioneel, niet voltooid.",
  stepCurrent: "Huidige stap.",
  stepIncomplete: "Niet voltooid.",
  steps: {
    createWorkspace: {
      label: "Werkruimte aanmaken",
      description: "Geef het merk van deze werkruimte een naam.",
    },
    addWebsite: {
      label: "Website toevoegen",
      description: "Optioneel. Alleen nodig voor crawling en SEO-audits.",
    },
    connectData: {
      label: "Data verbinden",
      description: "Verbind een bron of kies analyse op alleen crawldata.",
    },
    chooseGoal: {
      label: "Doel kiezen",
      description: "Vertel de audit welk resultaat er nu toe doet.",
    },
    runBaseline: {
      label: "Basismeting draaien",
      description: "Maak je eerste technische snapshot.",
    },
    reviewActions: {
      label: "Acties reviewen",
      description: "Kies de vervolgstap met de hoogste waarde.",
    },
    activateMonitoring: {
      label: "Monitoring activeren",
      description: "Plan herhaalaudits in voor regressies.",
    },
  },
  goals: {
    technicalHealth: {
      title: "Technische gezondheid verbeteren",
      description:
        "Prioriteer indexeerbaarheid, crawlbaarheid, prestaties en regressies.",
    },
    qualifiedTraffic: {
      title: "Gekwalificeerd verkeer laten groeien",
      description:
        "Vind pagina's en zoekopdrachten met het sterkste realistische potentieel.",
    },
    organicKeyEvents: {
      title: "Organische sleutelgebeurtenissen verhogen",
      description:
        "Weeg aanbevelingen op analytics- en conversieblootstelling.",
    },
    contentOpportunities: {
      title: "Contentkansen plannen",
      description:
        "Breng topicgaten in beeld en zet vraag om in een op bewijs gestoeld plan.",
    },
  },
  loading: {
    kicker: "Lokale API controleren",
    title: "Je werkruimte laden…",
    body: "Het dashboard bevestigt of er al een site is geconfigureerd.",
  },
  create: {
    kicker: "Stap 1 van 7",
    title: "Maak je eerste werkruimte",
    body: "Een werkruimte bevat de kanalen, het onderzoek en de notities van dit merk. Een website is optioneel — voeg er alleen een toe als je crawling en SEO-audits wilt.",
    notAddedTitle: "Site is niet toegevoegd",
    addedTitle: "Site toegevoegd",
    addedBody:
      "Ga verder door minstens één bron te verbinden of analyse op alleen crawldata te kiezen.",
    nameLabel: "Naam werkruimte",
    urlLabel: "Canonieke URL",
    optional: "Optioneel",
    urlHelp:
      "Laat leeg om eerst met social, advertenties en onderzoek te werken. Je kunt op elk moment een website toevoegen via Instellingen.",
    creating: "Werkruimte aanmaken…",
    submit: "Werkruimte aanmaken",
  },
  workspace: {
    kicker: "Actieve werkruimte",
    noWebsite: "Geen website — crawling en audits staan uit.",
  },
  evidence: {
    kicker: "Stap 3 van 7",
    title: "Kies je bewijs",
    body: "Verbind platforms die je team vertrouwt, of begin met crawldata en voeg integraties later toe. Ontbrekende bronnen verlagen de betrouwbaarheid; ze worden nooit nepnullen.",
    connectedIntegrations: "verbonden integraties",
    crawlOnlyTitle: "Analyse op alleen crawldata geselecteerd",
    crawlOnlyBody:
      "De basismeting kan nu draaien. Verbind later GSC of GA4 om betrouwbaarheid en blootstellingsscores te verbeteren.",
    manageIntegrations: "Integraties beheren",
    crawlOnlyButton: "Doorgaan met alleen crawldata",
  },
  goal: {
    kicker: "Stap 4 van 7",
    title: "Kies het resultaat dat er nu toe doet",
    body: "Het gekozen doel wordt bij de auditrun opgeslagen, zodat het doel expliciet is in de historie en in agentworkflows.",
    groupLabel: "Primair SEO-doel",
  },
  baseline: {
    kicker: "Stap 5 van 7",
    title: "Bouw de basismeting",
    body: "Een volledige audit geeft acties bewijs op URL-niveau en creëert een referentiepunt voor monitoring.",
    needsWebsiteTitle: "Deze stap heeft een website nodig",
    needsWebsiteBefore:
      "Een basisaudit crawlt je site. Voeg een website toe in",
    needsWebsiteLink: "Instellingen",
    needsWebsiteAfter:
      "om hem te ontgrendelen, of sla over — de rest van deze werkruimte werkt ook zonder.",
    chooseGoalTitle: "Kies eerst een doel",
    chooseGoalBody:
      "Selecteer hierboven het resultaat voordat je de basismeting start.",
    notStartedTitle: "Audit kon niet starten",
    queuedTitle: "Audit in wachtrij",
    queuedBody:
      "Volg de run via de audithistorie. Acties ontgrendelen pas nadat een voltooid of gedeeltelijk resultaat beschikbaar is.",
    privateAccessSummary: "Toegang tot privésites",
    privateAccessLabel:
      "Sta precies deze hostnaam toe om voor deze audit een privénetwerk te benaderen",
    privateAccessHelp:
      "Alleen {host}. Loopback- en privéadressen blijven geblokkeerd tenzij je deze host goedkeurt; cloudmetadata blijft altijd geblokkeerd.",
    starting: "Audit starten…",
    run: "Basisaudit draaien",
    viewHistory: "Audithistorie bekijken",
  },
  firstMove: {
    kicker: "Stap 6 van 7",
    title: "Kies de eerste zet",
    body: "Vergelijk impact, inspanning, betrouwbaarheid en bronbewijs voordat je middelen inzet. Deze stap ontgrendelt pas nadat de basismeting een voltooid of gedeeltelijk resultaat oplevert.",
    reviewActions: "Geprioriteerde acties reviewen",
    lockedReason: "Wachten op een voltooide basisrun.",
  },
  monitoring: {
    kicker: "Stap 7 van 7",
    title: "Lokale monitoring activeren",
    body: "Maak een duurzame wekelijkse audit om 06:00 elke maandag in je lokale tijdzone. Het ritme kun je aanpassen via Monitoring.",
    notActivatedTitle: "Monitoring is niet geactiveerd",
    activatedTitle: "Monitoring geactiveerd",
    activatedBody:
      "De lokale achtergrondservice draait het wekelijkse schema zolang hij beschikbaar is.",
    activeTitle: "Monitoring is actief",
    activeBody: "Minstens één ingeschakeld schema beschermt deze property.",
    activating: "Monitoring activeren…",
    activate: "Wekelijkse monitoring activeren",
    manage: "Monitoring beheren",
    lockedReason:
      "Voltooi de basismeting en open geprioriteerde acties voordat je monitoring activeert.",
  },
} as const;
