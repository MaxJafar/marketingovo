import type { MessagesFor } from "../types";

/** Public-web OSINT page: pass form, dossier cards, trust, findings, history. */
export const osintResearch: MessagesFor<"osintResearch"> = {
  eyebrow: "Productprioriteit · intelligencelaag",
  title: "OSINT op het publieke web",
  description:
    "Bouw een begrensd dossier met bronvermeldingen op uit je eigen site en maximaal vier expliciet opgegeven publieke doelen. De graaf bewaart wat is waargenomen zonder ontbrekende data tot een claim te maken.",
  available: "Beschikbaar",
  sourceLink: "bron",
  citedEvidenceOne: "{count} geciteerd bewijsitem",
  citedEvidenceMany: "{count} geciteerde bewijsitems",
  confidencePct: "{confidence}% betrouwbaarheid",
  evidence: {
    confidence: "{label} · {confidence}% betrouwbaarheid",
    observedAt: "· waargenomen {date}",
    claimLabel: "· claim",
  },
  form: {
    title: "Start een bewijspass",
    description:
      "De projectsite doet automatisch mee. Voeg publieke URL's van concurrenten, partners, nieuwspagina's of referenties toe wanneer ze binnen de scope vallen.",
    targetsLabel: "Extra publieke doelen",
    targetsHelp:
      "Maximaal vier URL's, één per regel. Alleen HTTPS; geen credentials, cookies, accountprobes of personenzoek-pivots.",
    queueing: "Publiek-webonderzoek in wachtrij zetten…",
    run: "OSINT-pass draaien",
    invalidTarget: "Gebruik een expliciete publieke https:// URL: {url}",
    rejectedTitle: "Doelenlijst is niet geaccepteerd",
    failedTitle: "OSINT-run kon niet starten",
    queuedTitle: "OSINT-run in wachtrij",
    queuedBody:
      "De run wordt verzameld binnen publiek-weblimieten. Deze pagina ververst zodra het bewijsdossier is opgeslagen.",
  },
  target: {
    eyebrow: "Doeldossier",
    pagesObserved: "Waargenomen pagina's",
    availableEvidence: "Beschikbaar bewijs",
    graphEntities: "Graafentiteiten",
    graphLinks: "Graafrelaties",
    finalUrl: "Uiteindelijke URL:",
    publishingSignalTitle: "Publiek publicatiesignaal",
    cadenceItemsOne: "{count} gedateerd item in de waargenomen feed",
    cadenceItemsMany: "{count} gedateerde items in de waargenomen feed",
    cadenceUnavailable: "; ritme is niet beschikbaar zonder gemeten interval.",
    cadenceAverage: "; gemiddeld interval {days} dagen.",
    cadenceDisclaimer: "Dit is publicatiebewijs, geen bereik of engagement.",
    notObservedTitle: "Doel is niet volledig waargenomen",
  },
  coverage: {
    title: "Dekking en beleid",
    description:
      "Elke waarneming behoudt haar bron en bewijsstatus. Een ontbrekend signaal wordt nooit omgezet in nul.",
    coverage: "Dekking",
    targetsCompleted: "Voltooide doelen",
    pagesObserved: "Waargenomen pagina's",
    evidenceAvailable: "Bewijs beschikbaar",
    publicWebOnly: "Alleen publiek web",
    personalDataDisabled: "Persoonsgegevens uitgeschakeld",
    identityResolutionDisabled: "Identiteitsherleiding uitgeschakeld",
    authenticatedCollectionDisabled: "Ingelogde verzameling uitgeschakeld",
    darkWebDisabled: "Dark web uitgeschakeld",
  },
  trust: {
    title: "Vertrouwen en herkomst",
    description:
      "Stabiele claimvingerafdrukken maken herhaalde passes auditeerbaar zonder een publiek-webwaarneming te presenteren als onafhankelijk geverifieerde waarheid.",
    claimFingerprints: "Claimvingerafdrukken",
    sourceUrlsRecorded: "Vastgelegde bron-URL's",
    integrityRecord: "Integriteitsrecord",
    recorded: "Vastgelegd",
    incomplete: "Onvolledig",
    legacyDossier: "Verouderd dossier",
    fingerprintAlgorithm: "Vingerafdrukalgoritme",
    evidenceDigest: "Bewijsdigest:",
    olderFormatTitle: "Ouder dossierformaat",
    olderFormatBody:
      "Deze opgeslagen pass dateert van vóór claimvingerafdrukken. Draai een nieuwe publiek-webpass om voor elke waarneming herkomst vast te leggen.",
    fingerprintScope:
      "Vingerafdrukken dekken de waargenomen claimvelden en sluiten het vastlegmoment bewust uit. De digest detecteert rapportwijzigingen; hij certificeert niet dat een bron nauwkeurig of gezaghebbend is.",
  },
  findings: {
    title: "Bevindingen",
    description:
      "Beschrijvende, aan bewijs gekoppelde waarnemingen van het publieke web.",
    empty: "Geen bevindingen werden ondersteund door het waargenomen bewijs.",
  },
  history: {
    title: "Pass-historie",
    comparedDescription:
      "Geciteerde publiek-webveranderingen sinds {date}. Een geblokkeerd doel wordt uitgesloten in plaats van behandeld als een verdwijning.",
    firstPassDescription:
      "Draai een tweede publiek-webpass om exacte signalen door de tijd te vergelijken.",
    baseline:
      "De eerste pass legt de basislijn vast. Latere passes rapporteren toegevoegd, verwijderd en veranderd bewijs zonder identiteitsclaims te doen.",
    noChanges:
      "Geen ondersteund publiek signaal is veranderd sinds de vorige pass.",
    targetLabel: "· doel",
  },
  dossiers: {
    title: "Doeldossiers",
    generatedOne: "Gegenereerd {date} · {count} begrensd brondoel.",
    generatedMany: "Gegenereerd {date} · {count} begrensde brondoelen.",
  },
  limitations: {
    title: "Bekende beperkingen",
    description:
      "Deze beperkingen zijn onderdeel van het dossiercontract, geen verborgen gat in de UI.",
  },
  noDossierTitle: "Nog geen OSINT-dossier",
  noDossierBody:
    "Draai hierboven een publiek-webpass om het eerste aan bewijs gekoppelde dossier voor dit project te maken.",
} as const;
