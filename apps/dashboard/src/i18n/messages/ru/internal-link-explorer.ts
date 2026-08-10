import type { MessagesFor } from "../types";

/** Per-page internal link explorer: direction tabs, summary, evidence table. */
export const internalLinkExplorer: MessagesFor<"internalLinkExplorer"> = {
  regionLabel: "Внутренние ссылки для {title}",
  eyebrow: "Неизменяемый граф обхода",
  closeExplorer: "Закрыть обозреватель",
  unavailableTitle: "Доказательства ссылок недоступны",
  unavailableBody:
    "Повторите этот аудит, чтобы захватить версионированные доказательства входящих и исходящих ссылок. Существующая история страниц и проблем не меняется.",
  directionTabsLabel: "Направление ссылок",
  inlinksTab: "Входящие · {count} источников",
  outlinksTab: "Исходящие · {count} целей",
  searchLabel: "Поиск в этом направлении",
  searchPlaceholder: "URL, заголовок страницы или текст анкора",
  search: "Искать",
  loading: "Чтение сохраненного графа ссылок…",
  graphUnavailableTitle: "Граф ссылок недоступен",
  summary: {
    inlinkSources: "Источники входящих ссылок",
    outlinkTargets: "Цели исходящих ссылок",
    totalOccurrences: "всего вхождений: {count}",
    redirectedTargets: "Цели с редиректом",
    redirectedHelp:
      "Внутренние ссылки, которым следует указывать на конечный URL",
    brokenTargets: "Битые цели",
    brokenHelp: "Адреса, возвращающие HTTP 4xx или 5xx",
  },
  coverageLimitationTitle: "Ограничение покрытия",
  table: {
    label: "{direction} для {title}",
    captionInlinks: "Страницы, ссылающиеся на выбранный URL",
    captionOutlinks: "Внутренние адреса, на которые ссылается выбранный URL",
    sourcePageColumn: "Страница-источник",
    destinationColumn: "Назначение",
    stateColumn: "Состояние",
    anchorColumn: "Данные анкора",
    followColumn: "Follow",
    finalUrl: "Конечный URL: {url}",
    httpStatus: "HTTP {status}",
    noTextCaptured: "Текст не захвачен",
    placementUnavailable: "Размещение недоступно",
    followSummary: "{follow} follow · {nofollow} nofollow",
  },
  empty: {
    noLinksMatch: "Ни одна ссылка не совпадает",
    noDirectionCaptured: "Не захвачено: {direction}",
    searchHint:
      "Попробуйте более широкий поиск по URL, заголовку или тексту анкора.",
    inlinksHint:
      "В выбранном снимке ни одна обойденная страница не ссылается на этот URL.",
    outlinksHint: "У этой страницы нет захваченных внутренних адресов.",
  },
  paginationLabel: "Страницы доказательств ссылок",
  previous: "Назад",
  next: "Далее",
  zeroResults: "0 результатов",
  resultsRange: "{from}–{to} из {total}",
};
