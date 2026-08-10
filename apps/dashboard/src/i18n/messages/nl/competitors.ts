import type { MessagesFor } from "../types";

/** Competitors: the comparison workflow and crawl-evidence cards. */
export const competitors: MessagesFor<"competitors"> = {
  eyebrow: "Marktcontext",
  title: "Concurrenten",
  description:
    "Crawlbewijs, publicatieritme en contentgaten, allemaal verzameld van de eigen site van elke rivaal — geen providersleutel nodig. Gaten op zoekwoordniveau blijven expliciet niet-beschikbaar totdat een ondersteunende provider ze levert.",
  form: {
    title: "Draai een reproduceerbare vergelijking",
    description:
      "Voer een of twee concurrentdomeinen in. Elke site wordt met dezelfde limieten gecrawld; deze weergave rapporteert technisch bewijs, geen verzonnen zichtbaarheidsdata.",
    domainsLabel: "Concurrentdomeinen",
    starting: "Starten…",
    submit: "Sites vergelijken",
  },
  notStartedTitle: "Vergelijking kon niet starten",
  queuedTitle: "Vergelijking in wachtrij",
  queuedBody:
    "De duurzame run is zichtbaar onder Audits. Deze pagina toont de laatst voltooide vergelijking.",
  card: {
    updated: "Bijgewerkt {date}",
    publishesEvery: "Publiceert elke",
    cadenceDays: "{count} dagen",
    cadenceUnavailableHint:
      "Er is geen feed gevonden, of de feed bevatte te weinig gedateerde posts om een interval te meten.",
    lastPublished: "Laatst gepubliceerd",
    daysAgo: "{count} dagen geleden",
    technicalHealth: "Technische gezondheid",
    change: "Verandering",
    changeUnavailableHint:
      "Geen eerdere vergelijking bevat deze site, dus er is geen basislijn om tegen af te zetten.",
    noChange: "Geen verandering",
    changePts: "{value} ptn",
    sharedKeywords: "Gedeelde zoekwoorden",
    keywordGaps: "Zoekwoordgaten",
    coversGapTopics: "Dekt gat-onderwerpen",
  },
  emptyTitle: "Geen concurrenten geconfigureerd",
  emptyBody:
    "Voeg concurrentdomeinen toe via de API of de setupflow om marktcontext te ontgrendelen.",
  gaps: {
    title: "Onderwerpen die zij dekken en jij niet",
    description:
      "Afgeleid uit de pagina's zelf, dus er is geen zoekwoordprovider nodig. Elke term komt op de concurrentpagina's met een wezenlijk hogere dichtheid voor dan op jouw site.",
    coverageOne: "op {covering} van {total} vergeleken site",
    coverageMany: "op {covering} van {total} vergeleken sites",
  },
} as const;
