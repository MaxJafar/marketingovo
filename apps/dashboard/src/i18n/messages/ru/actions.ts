import type { MessagesFor } from "../types";

/**
 * The Actions workbench: queue filters, the prioritized table, and the
 * marketer workflow controls.
 */
export const actions: MessagesFor<"actions"> = {
  eyebrow: "От доказательств к результату",
  title: "Действия",
  description:
    "Приоритизируйте, исследуйте, назначайте и проверяйте SEO-работу, не отрывая технические доказательства от бизнес-экспозиции.",
  statusNotSavedTitle: "Статус действия не был сохранен",
  filterTitle: "Найдите работу, которая важна сейчас",
  filterDescription:
    "Ищите по рекомендации, правилу, модулю или владельцу. Отсутствующие доказательства остаются недоступными и никогда не превращаются в ноль.",
  resetFilters: "Сбросить фильтры",
  searchLabel: "Поиск действий",
  searchPlaceholder: "Canonical, битые ссылки, владелец…",
  statusFilterLabel: "Статус",
  allStatuses: "Все статусы",
  verificationFilterLabel: "Проверка",
  allVerification: "Все состояния проверки",
  effortFilterLabel: "Трудозатраты",
  allEffort: "Любые трудозатраты",
  effortOption: {
    low: "Низкие",
    medium: "Средние",
    high: "Высокие",
  },
  sortByLabel: "Сортировать по",
  sortOption: {
    priority: "Оценке приоритета",
    updated: "Недавно обновленные",
    affected: "Затронутым URL",
    confidence: "Уверенности",
  },
  priorityLegend: "Приоритет",
  priorityGroupLabel: "Фильтровать действия по приоритету",
  priorityFilter: {
    all: "Все",
    critical: "Критический",
    high: "Высокий",
    medium: "Средний",
    low: "Низкий",
  },
  showingCount: "Показано {visible} из {total} действий",
  tableLabel: "Приоритизированные SEO-действия",
  columnPriority: "Приоритет",
  columnAction: "Действие и группа доказательств",
  columnScope: "Охват",
  columnEffort: "Трудозатраты",
  columnConfidence: "Уверенность",
  columnWorkflow: "Рабочий процесс",
  columnVerification: "Проверка",
  columnUpdated: "Обновлено",
  statusLabel: {
    open: "открыто",
    acknowledged: "принято",
    in_progress: "в работе",
    resolved: "решено",
  },
  verificationLabel: {
    pending: "ожидает",
    verified: "подтверждено",
    regressed: "регресс",
  },
  moduleUnavailable: "Модуль недоступен",
  ruleUnavailable: "Правило недоступно",
  affectedUrls: "затронутых URL",
  organicVisitsExposed: "затронуто органических визитов: {count}",
  businessExposureUnavailable: "Бизнес-экспозиция недоступна",
  workflowStatusFor: "Статус рабочего процесса для {title}",
  saving: "Сохранение…",
  emptyFilteredTitle: "Ни одно действие не подходит под эти фильтры",
  emptyFilteredDescription:
    "Сбросьте один или несколько фильтров, чтобы вернуться к полной очереди, подкрепленной доказательствами.",
  emptyQueueTitle: "Приоритизированных действий пока нет",
  emptyQueueDescription:
    "Запустите аудит, чтобы сформировать первую очередь действий. Корректный пустой результат никогда не выдается за идеальную оценку.",
};
