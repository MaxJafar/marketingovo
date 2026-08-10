/** The console home: hero banner, KPI stats, and the overview panels. */
export const dashboard = {
  hero: {
    welcome: "welcome to",
    tagline: "your all-in-one marketing intelligence terminal",
    bubble: "data never sleeps",
  },
  stats: {
    seoVisibility: "SEO visibility",
    organicTraffic: "Organic traffic",
    keyEvents: "Key events",
    cwvPassRate: "CWV pass rate",
    noTrendYet: "no trend yet",
    /** Rendered through `toDelta` in lib/intel.ts. */
    noChange: "no change",
    runAuditToMeasure: "run an audit to measure",
    connectSearchConsole: "connect Search Console",
    connectAnalytics: "connect Analytics",
    runAuditWithVitals: "run an audit with vitals",
  },
  seoOverview: {
    title: "SEO overview",
    domainHealth: "Domain health",
    empty:
      "No audit has measured this site yet, so there is no health score to draw — a placeholder number would be an invention.",
    runAudit: "Run an audit →",
    donutLabel: "Domain health {value} out of 100",
    crawlability: "Crawlability",
    sitePerformance: "Site Performance",
    onPageSeo: "On-Page SEO",
    keyEvents: "Key events",
  },
  crossChannel: {
    title: "Cross-channel report",
    body: "The client-facing document across paid, organic, social, email, competitors and completed work — charts drawn only from measured values, exported as PDF, and generated on a daily, weekly or monthly schedule.",
    openReport: "Open the report →",
    scheduleIt: "Schedule it →",
  },
  topKeywords: {
    title: "Top keywords",
    empty: "No keyword research has run for this workspace yet.",
    openLab: "Open the keyword lab →",
    keyword: "Keyword",
    position: "Pos.",
    volume: "Vol.",
    viewAll: "View all keywords →",
  },
  competitorInsights: {
    title: "Competitor insights",
    empty:
      "No competitor comparison has run yet, so there is nothing measured to rank.",
    research: "Research competitors →",
    domain: "Domain",
    visibility: "Visibility",
    you: "you ({name})",
    thisSite: "this site",
    viewAll: "View competitors →",
  },
  contentFeed: {
    title: "Content intel feed",
    empty:
      "Content gaps appear here after a competitor comparison measures them.",
    open: "Open content intel →",
    competitorsCovering: "◉ {count} competitors covering",
    gapTag: "Content gap",
    viewFeed: "View content feed →",
  },
} as const;
