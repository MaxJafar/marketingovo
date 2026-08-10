import type { MessagesFor } from "../types";

/** Shared primitives: formatters, query states, capability gates, freshness. */
export const common: MessagesFor<"common"> = {
  unavailable: "Недоступно",
  noComparison: "Сравнение недоступно",
  vsPriorPeriod: "{change}% к прошлому периоду",
  createWorkspaceTitle: "Создайте рабочее пространство, чтобы начать",
  createWorkspaceBody:
    "Рабочее пространство хранит ваши каналы, исследования и заметки. Создайте его, чтобы начать, — сайт можно добавить позже или не добавлять вовсе.",
  loadingLabel: "Загрузка данных",
  errorTitle: "Данные недоступны",
  errorFallback: "API не вернул это рабочее пространство.",
  errorHint:
    "Ни одно значение не подменено нулем. Проверьте локальный API и здоровье интеграций.",
  tryAgain: "Повторить",
  gateTitle: "Здесь не хватает одного шага",
  gateHint:
    "Все остальное в этом рабочем пространстве продолжает работать. Ничего здесь не заполнено заглушкой.",
  freshness: {
    stale:
      "Это представление использует последний доступный снимок. Недавние изменения могут в него не попасть.",
    missing:
      "Один или несколько источников не предоставили данные для этого представления.",
    unavailable: "Один или несколько источников оказались недоступны.",
    unknown: "API не дал гарантии свежести для этого ответа.",
    fresh: "Ответ содержит предупреждения источников.",
  },
  snapshot: "Снимок: {time}",
  invalidSessionResponse: "Локальный сервис вернул некорректный ответ сеанса.",
  importTooLarge: "Файл .marketingovo должен быть не больше 25 МиБ.",
  importWrongExtension: "Выберите файл с расширением .marketingovo.",
  serviceUnreachable: "Локальный сервис недоступен.",
  messageNotSent: "Это сообщение не было отправлено.",
  trendUnavailable: "Тренд недоступен",
  trendEmptyBody:
    "Чтобы построить достоверный тренд, нужны минимум два датированных измерения.",
  historicalSignal: "Исторический сигнал",
  observations: "{count} наблюдений",
  trendRange: "{title}, от {min} до {max}",
};
