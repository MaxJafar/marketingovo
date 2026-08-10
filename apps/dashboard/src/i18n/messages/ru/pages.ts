import type { MessagesFor } from "../types";

/** URL inventory: the crawled pages table and its indexability evidence. */
export const pages: MessagesFor<"pages"> = {
  eyebrow: "Инвентарь URL",
  title: "Страницы",
  description:
    "Свяжите технические доказательства обхода с органическим трафиком и конверсионным контекстом на уровне URL.",
  columns: {
    page: "Страница",
    http: "HTTP",
    indexability: "Индексируемость",
    clicks: "Клики",
    internalLinks: "Внутренние ссылки",
    organicKeyEvents: "Органические ключевые события",
    issues: "Проблемы",
    coreWebVitals: "Core Web Vitals",
    lastCrawled: "Последний обход",
  },
  linkCounts: "{inCount} вх · {outCount} исх",
  linkDepth: "Глубина {depth} · уникальные страницы",
  explore: "Исследовать",
  exploreLinksFor: "Исследовать внутренние ссылки {page}",
  searchLabel: "Поиск страниц",
  searchPlaceholder: "Поиск по заголовку или URL",
  tableLabel: "Обойденные страницы",
  noMatchTitle: "Ни одна страница не совпадает",
  noMatchBody: "Попробуйте более широкий поиск по заголовку или URL.",
  emptyTitle: "Обойденных страниц нет",
  emptyBody:
    "API вернул пустой инвентарь страниц. Запустите аудит, чтобы собрать доказательства на уровне URL.",
  indexability: {
    reasons: {
      indexable: "Подтверждено данными обхода",
      robotsBlocked: "Заблокировано в robots.txt",
      metaNoindex: "Noindex в meta robots",
      xRobotsNoindex: "Noindex в X-Robots-Tag",
      canonicalized: "Canonical указывает на другой URL",
      nonHtml: "Ответ не в формате HTML",
      redirect: "Ответ с редиректом",
      httpError: "Ответ с ошибкой HTTP",
      noContent: "Пустое тело ответа",
      fetchError: "Запрос не удался",
      missingStatus: "Статус HTTP недоступен",
      unexpectedStatus: "Неожиданный статус HTTP",
      missingContentType: "Тип содержимого недоступен",
      robotsUnknown: "Данные robots недоступны",
      parseFailed: "Данные HTML недоступны",
    },
    evidenceUnavailable: "Доказательства недоступны",
    legacyResult: "Результат старого аудита",
  },
};
