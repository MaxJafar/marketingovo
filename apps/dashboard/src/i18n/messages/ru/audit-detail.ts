import type { MessagesFor } from "../types";

/** The audit run page: replay, sitemap coverage, and the evidence workbench. */
export const auditDetail: MessagesFor<"auditDetail"> = {
  backToAudits: "Назад к аудитам",
  eyebrow: "Запуск аудита",
  runTitle: "Запуск {id}",
  fallbackTitle: "Детали аудита",
  description:
    "Изучите покрытие источников и точные доказательства или повторите сохраненную конфигурацию запуска против текущего состояния сайта.",
  queuingReplay: "Постановка повтора в очередь…",
  replayConfiguration: "Повторить конфигурацию",
  replayErrorTitle: "Повтор не удалось начать",
  replayQueuedTitle: "Независимый повтор в очереди",
  replayQueuedBefore:
    "Сохраненная конфигурация v{version} скопирована без изменения этого запуска. Повтор читает текущее состояние сайта и провайдеров.",
  replayQueuedLink: "Открыть повтор",
  replayQueuedAfter: ".",
  boundaryTitle: "Граница повтора",
  boundaryBody:
    "Повтор создает новый запуск из этого сохраненного процесса и его точных настроек. Он никогда не правит этот результат; живые страницы и интеграции опрашиваются заново, чтобы изменения оставались измеримыми.",
  summary: {
    status: "Статус",
    started: "Начат",
    completed: "Завершен",
    issueInstances: "Экземпляры проблем",
  },
  breakdownTitle: "Разбивка проблем",
  breakdownEmptyTitle: "Разбивка недоступна",
  breakdownEmptyBody: "Запуск не вернул итоги по серьезности.",
  runLogTitle: "Журнал запуска",
  runLogEmptyTitle: "Записей журнала нет",
  runLogEmptyBody: "API не вернул журнал запуска.",
  sitemap: {
    eyebrow: "Захваченный источник",
    title: "Покрытие карты сайта",
    description:
      "Покрытие сравнивает захваченные индексируемые URL обхода со снимком карты сайта, использованным именно этим запуском.",
    declaredUrls: "Объявленные URL",
    indexableDiscovered: "Найдено индексируемых",
    matched: "Совпало",
    coverage: "Покрытие",
    snapshotBefore: "Снимок:",
    httpStatusSuffix: " · HTTP {status}",
    filesLabel: "Захваченные файлы карты сайта",
    fileColumn: "Файл карты сайта",
    typeColumn: "Тип",
    httpColumn: "HTTP",
    locationsColumn: "Адреса",
    missingIndexable: "Индексируемые, но отсутствующие",
    declaredNotCrawled: "Объявленные, но не обойденные",
    brokenDeclared: "Объявленные с ошибками HTTP",
    sampleUnavailable:
      "Недоступно, потому что проверенный снимок карты сайта не был захвачен.",
    sampleTruncated:
      "Показаны первые {shown} из {total} URL. JSON-отчет сохраняет полную захваченную когорту.",
  },
  tabs: {
    crawl: {
      label: "Пути обхода",
      description: "Кратчайший захваченный путь обнаружения и первый реферер.",
    },
    redirects: {
      label: "Редиректы",
      description: "Запрошенный URL, каждый шаг редиректа и итоговый ответ.",
    },
    hreflang: {
      label: "Hreflang",
      description: "Языковые цели, самоссылки и доказательства взаимности.",
    },
    extractions: {
      label: "Извлечения",
      description:
        "Пользовательские поля, захваченные настроенными правилами извлечения.",
    },
  },
  crawl: {
    tableLabel: "Доказательства путей обхода",
    pageColumn: "Страница",
    depthColumn: "Глубина",
    referrerColumn: "Первый реферер",
    httpColumn: "HTTP",
    indexableColumn: "Индексируемость",
    seed: "Старт",
  },
  redirects: {
    tableLabel: "Доказательства путей редиректов",
    requestedColumn: "Запрошенный URL",
    pathColumn: "Захваченный путь",
    hopsColumn: "Шаги",
    finalHttpColumn: "Итоговый HTTP",
  },
  hreflang: {
    tableLabel: "Матрица доказательств hreflang",
    sourceColumn: "Страница-источник",
    languageColumn: "Язык HTML / self",
    alternateColumn: "Alternate",
    targetColumn: "Цель",
    reciprocalColumn: "Взаимность",
    missing: "Отсутствует",
    selfReference: "Самоссылка",
    mismatch: "Ожидалось {expected}; наблюдалось {observed}",
    sourceFallback: "источник",
    noneFallback: "нет",
  },
  extractions: {
    tableLabel: "Доказательства пользовательских извлечений",
    pageColumn: "Страница",
    fieldsColumn: "Захваченные поля",
    noMatch: "Нет совпадения",
    truncatedSuffix: " (обрезано)",
  },
  workbench: {
    eyebrow: "Версионированные доказательства аудита",
    title: "Рабочая область доказательств",
    description:
      "UI постранично листает сохраненные доказательства и никогда не обрезает когорту, не показав итог.",
    tablistLabel: "Разделы доказательств",
    searchLabel: "Поиск доказательств по URL или заголовку страницы",
    searchPlaceholder: "Поиск по URL или заголовку страницы",
    search: "Искать",
    clear: "Очистить",
    paginationLabel: "Страницы доказательств",
    previous: "Назад",
    next: "Далее",
    pageIndicator: "Страница {page} из {pages} · записей: {records}",
  },
  emptyTitle: "Не захвачено: {section}",
  emptyUnavailable:
    "Этот запуск не содержит версионированных доказательств страниц. Запустите новый аудит, чтобы заполнить рабочую область.",
  emptyFiltered:
    "В выбранном запуске нет совпадений по фильтру: {section}. Это измеренное пустое состояние, а не сбой запроса.",
  fallbackEvidence: "доказательства",
  fallbackRecords: "записи",
};
