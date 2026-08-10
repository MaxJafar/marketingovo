/** The console home: hero banner, KPI stats, and the overview panels. */
import type { MessagesFor } from "../types";

export const dashboard: MessagesFor<"dashboard"> = {
  hero: {
    welcome: "qarşınızda",
    tagline: "hər şeyi bir yerdə birləşdirən marketinq kəşfiyyatı terminalınız",
    bubble: "data heç vaxt yatmır",
  },
  stats: {
    seoVisibility: "SEO görünürlüyü",
    organicTraffic: "Orqanik trafik",
    keyEvents: "Əsas hadisələr",
    cwvPassRate: "CWV keçid faizi",
    noTrendYet: "hələ trend yoxdur",
    /** Rendered through `toDelta` in lib/intel.ts. */
    noChange: "dəyişiklik yoxdur",
    runAuditToMeasure: "ölçmək üçün audit işlədin",
    connectSearchConsole: "Search Console-u qoşun",
    connectAnalytics: "Analytics-i qoşun",
    runAuditWithVitals: "vitals ölçmələri ilə audit işlədin",
  },
  seoOverview: {
    title: "SEO icmalı",
    domainHealth: "Domen sağlamlığı",
    empty:
      "Bu saytı hələ heç bir audit ölçməyib, ona görə də çəkiləcək sağlamlıq balı yoxdur — yer tutucu rəqəm uydurma olardı.",
    runAudit: "Audit işlət →",
    donutLabel: "Domen sağlamlığı 100-dən {value}",
    crawlability: "Taranabilirlik",
    sitePerformance: "Sayt performansı",
    onPageSeo: "Səhifədaxili SEO",
    keyEvents: "Əsas hadisələr",
  },
  crossChannel: {
    title: "Çarpaz kanal hesabatı",
    body: "Ödənişli, orqanik, sosial, e-poçt, rəqiblər və tamamlanmış işləri əhatə edən müştəriyə ünvanlı sənəd — qrafiklər yalnız ölçülmüş dəyərlərdən çəkilir, PDF kimi ixrac olunur və gündəlik, həftəlik və ya aylıq qrafiklə yaradılır.",
    openReport: "Hesabatı aç →",
    scheduleIt: "Qrafikə sal →",
  },
  topKeywords: {
    title: "Ən yaxşı açar sözlər",
    empty: "Bu iş sahəsi üçün hələ açar söz araşdırması aparılmayıb.",
    openLab: "Açar söz laboratoriyasını aç →",
    keyword: "Açar söz",
    position: "Möv.",
    volume: "Həc.",
    viewAll: "Bütün açar sözlərə bax →",
  },
  competitorInsights: {
    title: "Rəqib təhlilləri",
    empty:
      "Hələ rəqib müqayisəsi aparılmayıb, ona görə də sıralanacaq ölçülmüş heç nə yoxdur.",
    research: "Rəqibləri araşdır →",
    domain: "Domen",
    visibility: "Görünürlük",
    you: "siz ({name})",
    thisSite: "bu sayt",
    viewAll: "Rəqiblərə bax →",
  },
  contentFeed: {
    title: "Kontent kəşfiyyat lenti",
    empty:
      "Kontent boşluqları rəqib müqayisəsi onları ölçdükdən sonra burada görünür.",
    open: "Kontent kəşfiyyatını aç →",
    competitorsCovering: "◉ {count} rəqib əhatə edir",
    gapTag: "Kontent boşluğu",
    viewFeed: "Kontent lentinə bax →",
  },
};
