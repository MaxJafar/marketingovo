import type { MessagesFor } from "../types";

/** The local runtime page: overall status, uptime, and component checks. */
export const systemHealth: MessagesFor<"systemHealth"> = {
  eyebrow: "Локальная среда",
  title: "Здоровье системы",
  description:
    "Проверьте API панели, хранилище, воркеры и внешние коннекторы, прежде чем доверять отчетному снимку.",
  overallStatus: "Общий статус",
  statusHealthy: "Все отчитавшиеся системы работают",
  statusDegraded: "Некоторым сервисам нужно внимание",
  statusOffline: "Локальный API сообщает о сбое",
  statusUnknown: "Статус неизвестен",
  version: "Версия",
  uptime: "Время работы",
  uptimeDaysHours: "{days}д {hours}ч",
  uptimeHours: "{hours}ч",
  checked: "Проверено",
  latency: "Задержка",
  latencyValue: "{value} мс",
  emptyTitle: "Нет проверок компонентов",
  emptyDescription:
    "API вернул общее состояние, но без проверок на уровне компонентов.",
};
