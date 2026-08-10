import type { MessagesFor } from "../types";

/** The decision-center overview: health hero, metric grid, source health. */
export const overview: MessagesFor<"overview"> = {
  eyebrow: "Центр решений",
  siteTitle: "Обзор {name}",
  fallbackTitle: "Ваш маркетинговый обзор",
  description:
    "Смотрите, что изменилось, что важно и какой ход вероятнее всего улучшит результаты.",
  startingAudit: "Запуск аудита…",
  runFullAudit: "Запустить полный аудит",
  auditNotStartedTitle: "Аудит не удалось начать",
  auditQueuedTitle: "Аудит в очереди",
  auditQueuedBody:
    "Аудит принят. Следите за прогрессом в рабочем пространстве Аудиты.",
  health: {
    eyebrow: "Здоровье сайта",
    title: "Ясная база для вашего следующего решения",
    body: "Оценка здоровья объединяет сигналы, возвращенные вашими настроенными источниками аудита. Отсутствующие входные данные остаются видимыми.",
    reviewActions: "Просмотреть приоритизированные действия",
    currentScore: "Текущая оценка",
    pointsVsPriorAudit: "{change} баллов здоровья к прошлому аудиту",
    comparisonUnavailable: "Сравнение недоступно",
  },
  regressions: {
    eyebrow: "Следите сейчас",
    title: "Критические регрессии",
    body: "Проблемы, которым может понадобиться немедленный разбор.",
    openQueue: "Открыть очередь действий",
  },
  performance: {
    title: "Показатели одним взглядом",
    description:
      "Маркетинговые результаты и техническое покрытие — без превращения отсутствующих данных в ноль.",
    organicClicks: "Органические клики",
    organicClicksHelp: "Подключите Search Console для сравнений",
    organicKeyEvents: "Органические ключевые события",
    organicKeyEventsHelp:
      "Подключите GA4, чтобы измерять органические результаты",
    indexableCoverage: "Индексируемое покрытие",
    coreWebVitalsPassRate: "Доля прохождения Core Web Vitals",
  },
  topActions: {
    title: "Топ-5 действий",
    description:
      "Ранжированы по оценке влияния, трудозатратам, уверенности и доказательствам, предоставленным API.",
    viewAll: "Все действия",
    emptyTitle: "Приоритизированных действий пока нет",
    emptyDescription:
      "Запустите базовый аудит после подключения источников данных. Корректный пустой результат показывается пустым, а не идеальной оценкой.",
  },
  trendTitle: "Тренд оценки здоровья",
  sources: {
    title: "Здоровье источников данных",
    description: "Знайте, какие входные данные поддерживают это представление.",
    manage: "Управлять",
    updated: "Обновлено {date}",
    coverage: "покрытие {value}%",
    unavailableTitle: "Статус источников недоступен",
    unavailableBody: "API не указал источники, стоящие за этим обзором.",
  },
};
