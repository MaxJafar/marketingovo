import type { MessagesFor } from "../types";

/** The console home: hero banner, KPI stats, and the overview panels. */
export const dashboard: MessagesFor<"dashboard"> = {
  hero: {
    welcome: "welkom bij",
    tagline: "je alles-in-één marketing-intelligenceterminal",
    bubble: "data slaapt nooit",
  },
  stats: {
    seoVisibility: "SEO-zichtbaarheid",
    organicTraffic: "Organisch verkeer",
    keyEvents: "Sleutelgebeurtenissen",
    cwvPassRate: "CWV-slagingspercentage",
    noTrendYet: "nog geen trend",
    /** Rendered through `toDelta` in lib/intel.ts. */
    noChange: "geen verandering",
    runAuditToMeasure: "draai een audit om te meten",
    connectSearchConsole: "verbind Search Console",
    connectAnalytics: "verbind Analytics",
    runAuditWithVitals: "draai een audit met vitals",
  },
  seoOverview: {
    title: "SEO-overzicht",
    domainHealth: "Domeingezondheid",
    empty:
      "Nog geen audit heeft deze site gemeten, dus er is geen gezondheidsscore om te tekenen — een placeholdergetal zou een verzinsel zijn.",
    runAudit: "Draai een audit →",
    donutLabel: "Domeingezondheid {value} van 100",
    crawlability: "Crawlbaarheid",
    sitePerformance: "Siteprestaties",
    onPageSeo: "On-page SEO",
    keyEvents: "Sleutelgebeurtenissen",
  },
  crossChannel: {
    title: "Cross-channelrapport",
    body: "Het klantgerichte document over betaald, organisch, social, e-mail, concurrenten en afgerond werk — grafieken uitsluitend uit gemeten waarden, geëxporteerd als PDF en gegenereerd op een dagelijks, wekelijks of maandelijks schema.",
    openReport: "Open het rapport →",
    scheduleIt: "Plan het in →",
  },
  topKeywords: {
    title: "Topzoekwoorden",
    empty: "Er is nog geen zoekwoordonderzoek gedraaid voor deze werkruimte.",
    openLab: "Open het zoekwoordlab →",
    keyword: "Zoekwoord",
    position: "Pos.",
    volume: "Vol.",
    viewAll: "Alle zoekwoorden bekijken →",
  },
  competitorInsights: {
    title: "Concurrentinzichten",
    empty:
      "Er is nog geen concurrentvergelijking gedraaid, dus er is niets gemeten om te rangschikken.",
    research: "Concurrenten onderzoeken →",
    domain: "Domein",
    visibility: "Zichtbaarheid",
    you: "jij ({name})",
    thisSite: "deze site",
    viewAll: "Concurrenten bekijken →",
  },
  contentFeed: {
    title: "Content-intelfeed",
    empty:
      "Contentgaten verschijnen hier nadat een concurrentvergelijking ze heeft gemeten.",
    open: "Content intel openen →",
    competitorsCovering: "◉ {count} concurrenten dekken dit",
    gapTag: "Contentgat",
    viewFeed: "Contentfeed bekijken →",
  },
} as const;
