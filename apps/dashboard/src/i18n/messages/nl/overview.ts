import type { MessagesFor } from "../types";

/** The decision-center overview: health hero, metric grid, source health. */
export const overview: MessagesFor<"overview"> = {
  eyebrow: "Beslissingscentrum",
  siteTitle: "Overzicht van {name}",
  fallbackTitle: "Je marketingoverzicht",
  description:
    "Zie wat er veranderde, wat ertoe doet en welke zet de resultaten het meest waarschijnlijk verbetert.",
  startingAudit: "Audit starten…",
  runFullAudit: "Volledige audit draaien",
  auditNotStartedTitle: "Audit kon niet starten",
  auditQueuedTitle: "Audit in wachtrij",
  auditQueuedBody:
    "De audit is geaccepteerd. Volg de voortgang via de Audits-werkruimte.",
  health: {
    eyebrow: "Sitegezondheid",
    title: "Een heldere basislijn voor je volgende beslissing",
    body: "De gezondheidsscore combineert de signalen van je geconfigureerde auditbronnen. Ontbrekende invoer blijft zichtbaar.",
    reviewActions: "Geprioriteerde acties reviewen",
    currentScore: "Huidige score",
    pointsVsPriorAudit: "{change} gezondheidspunten t.o.v. vorige audit",
    comparisonUnavailable: "Vergelijking niet beschikbaar",
  },
  regressions: {
    eyebrow: "Nu in de gaten houden",
    title: "Kritieke regressies",
    body: "Issues die mogelijk directe triage nodig hebben.",
    openQueue: "Actiewachtrij openen",
  },
  performance: {
    title: "Prestaties in één oogopslag",
    description:
      "Marketingresultaten en technische dekking, zonder ontbrekende data in nul om te zetten.",
    organicClicks: "Organische klikken",
    organicClicksHelp: "Verbind Search Console voor vergelijkingen",
    organicKeyEvents: "Organische sleutelgebeurtenissen",
    organicKeyEventsHelp: "Verbind GA4 om organische resultaten te meten",
    indexableCoverage: "Indexeerbare dekking",
    coreWebVitalsPassRate: "Core Web Vitals-slagingspercentage",
  },
  topActions: {
    title: "Top 5 acties",
    description:
      "Gerangschikt op geschatte impact, inspanning, betrouwbaarheid en het bewijs dat de API levert.",
    viewAll: "Alle acties bekijken",
    emptyTitle: "Nog geen geprioriteerde acties",
    emptyDescription:
      "Draai een basisaudit nadat je je databronnen hebt verbonden. Een geldig leeg resultaat wordt als leeg getoond — niet als een perfecte score.",
  },
  trendTitle: "Trend gezondheidsscore",
  sources: {
    title: "Gezondheid van databronnen",
    description: "Weet welke invoer deze weergave ondersteunt.",
    manage: "Beheren",
    updated: "Bijgewerkt {date}",
    coverage: "{value}% dekking",
    unavailableTitle: "Bronstatus niet beschikbaar",
    unavailableBody:
      "De API gaf niet aan welke bronnen achter dit overzicht zitten.",
  },
} as const;
