import type { MessagesFor } from "../types";

/** The console home: hero banner, KPI stats, and the overview panels. */
export const dashboard: MessagesFor<"dashboard"> = {
  hero: {
    welcome: "добро пожаловать в",
    tagline: "ваш универсальный терминал маркетинговой разведки",
    bubble: "данные не спят",
  },
  stats: {
    seoVisibility: "SEO-видимость",
    organicTraffic: "Органический трафик",
    keyEvents: "Ключевые события",
    cwvPassRate: "Прохождение CWV",
    noTrendYet: "тренда пока нет",
    /** Rendered through `toDelta` in lib/intel.ts. */
    noChange: "без изменений",
    runAuditToMeasure: "запустите аудит для измерения",
    connectSearchConsole: "подключите Search Console",
    connectAnalytics: "подключите Analytics",
    runAuditWithVitals: "запустите аудит с vitals",
  },
  seoOverview: {
    title: "SEO-обзор",
    domainHealth: "Здоровье домена",
    empty:
      "Ни один аудит еще не измерял этот сайт, поэтому оценку здоровья рисовать не из чего — число-заглушка было бы выдумкой.",
    runAudit: "Запустить аудит →",
    donutLabel: "Здоровье домена: {value} из 100",
    crawlability: "Обходимость",
    sitePerformance: "Производительность сайта",
    onPageSeo: "Внутренняя оптимизация",
    keyEvents: "Ключевые события",
  },
  crossChannel: {
    title: "Кросс-канальный отчет",
    body: "Документ для клиента по платному трафику, органике, соцсетям, почте, конкурентам и завершенной работе — графики строятся только из измеренных значений, экспортируется в PDF и формируется по ежедневному, еженедельному или ежемесячному расписанию.",
    openReport: "Открыть отчет →",
    scheduleIt: "Поставить в расписание →",
  },
  topKeywords: {
    title: "Топ ключевых слов",
    empty:
      "Для этого рабочего пространства еще не выполнялось исследование ключевых слов.",
    openLab: "Открыть лабораторию ключевых слов →",
    keyword: "Ключевое слово",
    position: "Поз.",
    volume: "Объем",
    viewAll: "Все ключевые слова →",
  },
  competitorInsights: {
    title: "Инсайты о конкурентах",
    empty:
      "Сравнение конкурентов еще не выполнялось, поэтому измеренного и пригодного для ранжирования пока нет.",
    research: "Исследовать конкурентов →",
    domain: "Домен",
    visibility: "Видимость",
    you: "вы ({name})",
    thisSite: "этот сайт",
    viewAll: "К конкурентам →",
  },
  contentFeed: {
    title: "Лента контент-разведки",
    empty:
      "Контентные пробелы появляются здесь после того, как их измерит сравнение конкурентов.",
    open: "Открыть контент-разведку →",
    competitorsCovering: "◉ {count} конкурентов освещают",
    gapTag: "Контентный пробел",
    viewFeed: "Лента контента →",
  },
};
