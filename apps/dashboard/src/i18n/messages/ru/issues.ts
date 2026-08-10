import type { MessagesFor } from "../types";

/** Issue review: filters, the evidence table, and the adjudication editor. */
export const issues: MessagesFor<"issues"> = {
  eyebrow: "Контроль качества",
  title: "Разбор проблем",
  description:
    "Изучайте доказательства обхода, документируйте намеренные исключения и не пускайте ложные срабатывания в будущие приоритеты, не стирая историю аудитов.",
  filters: {
    title: "Отделите сигнал от принятого поведения",
    description:
      "Ищите по заголовкам, правилам, модулям, отпечаткам и каноническим URL. Решения действуют в рамках выбранного сайта.",
    reset: "Сбросить фильтры",
    searchLabel: "Поиск проблем",
    searchPlaceholder: "Правило, URL, заголовок, отпечаток…",
    status: "Статус",
    allStatuses: "Все статусы",
    statusOpen: "Открытые",
    statusResolved: "Решенные аудитом",
    statusIgnored: "Игнорируемые намеренно",
    statusFalsePositive: "Ложные срабатывания",
    severity: "Серьезность",
    allSeverities: "Все уровни серьезности",
    severityCritical: "Критические",
    severityHigh: "Высокие",
    severityMedium: "Средние",
    severityLow: "Низкие",
    severityInfo: "Инфо",
  },
  showingRange: "Показаны {start}–{end} из {total} проблем",
  tableLabel: "SEO-проблемы, ожидающие решения по разбору или уже имеющие его",
  columns: {
    severity: "Серьезность",
    issue: "Проблема",
    url: "URL",
    status: "Статус",
    occurrences: "Вхождения",
    lastSeen: "Последний раз",
    review: "Разбор",
  },
  siteWide: "По всему сайту",
  /** Keyed by the API's `IssueStatus` enum; fall back to the raw value. */
  statusLabel: {
    open: "открыта",
    resolved: "решена",
    ignored: "игнорируется",
    false_positive: "ложное срабатывание",
  },
  hide: "Скрыть",
  review: "Разобрать",
  paginationLabel: "Страницы проблем",
  previous: "Назад",
  next: "Далее",
  pageOf: "Страница {page} из {total}",
  emptyFilteredTitle: "Ни одна проблема не совпадает",
  emptyFilteredBody:
    "Расширьте фильтры или поищите другое правило, модуль, заголовок или URL.",
  emptyOpenTitle: "Открытых проблем нет",
  emptyOpenBody:
    "Запустите аудит, чтобы собрать доказательства проблем, или переключите фильтр статуса для просмотра решенных находок.",
  editor: {
    eyebrow: "Разбор доказательств",
    close: "Закрыть разбор",
    rule: "Правило",
    module: "Модуль",
    firstSeen: "Впервые замечена",
    occurrences: "Вхождения",
    evidenceTitle: "Захваченные доказательства",
    structuredEvidence: "Структурированные доказательства",
    noEvidence:
      "У этой находки нет структурированных доказательств. Просмотрите правило, URL и историю аудитов, прежде чем классифицировать ее.",
    decision: "Решение по разбору",
    keepTitle: "Оставить в работе",
    keepBody:
      "Убрать ручное переопределение и оценивать будущие запуски как обычно.",
    ignoreTitle: "Игнорировать намеренно",
    ignoreBody: "Поведение реально, понято и принято для этого сайта.",
    falsePositiveTitle: "Отметить как ложное срабатывание",
    falsePositiveBody:
      "Правило некорректно описывает эту страницу или реализацию.",
    reasonLabel: "Причина решения",
    reasonRequired: "(обязательно)",
    reasonOptional: "(необязательно)",
    reasonPlaceholder:
      "Опишите контекст сайта, чтобы другой маркетолог мог позже проверить это решение.",
    charCount: "{count} / 2000 символов",
    confirmation:
      "Доказательства изучены. Сохранять эту классификацию в будущих аудитах, пока кто-то не откроет ее заново.",
    saved: "Разбор сохранен. Действия и приоритеты обзора обновлены.",
    saving: "Сохранение…",
    save: "Сохранить разбор",
    retention: "Сырые доказательства аудита и история никогда не удаляются.",
  },
};
