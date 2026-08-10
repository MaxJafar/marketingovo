import type { MessagesFor } from "../types";

/**
 * Ad Cabinets — connections, linked cabinets, stored performance, wasted
 * queries, and the spend-approval queue. Conventions in shell.ts.
 */
export const adCabinets: MessagesFor<"adCabinets"> = {
  platformLabel: {
    all: "Все плейсменты",
    facebook: "Facebook",
    instagram: "Instagram",
    messenger: "Messenger",
    audience_network: "Audience Network",
    google_search: "Поиск Google",
    google_search_partners: "Поисковые партнеры",
    google_display: "Медийная сеть Google",
    google_youtube: "YouTube",
    google_performance_max: "Performance Max",
    unknown: "Другой плейсмент",
  },
  metricLabel: {
    spend: "Расходы",
    impressions: "Показы",
    clicks: "Клики",
    link_clicks: "Клики по ссылке",
    conversions: "Конверсии",
    conversion_value: "Ценность конверсий",
    cost_per_conversion: "Стоимость конверсии",
    ctr: "CTR",
    cpc: "CPC",
    cpm: "CPM",
    reach: "Охват",
    frequency: "Частота",
    video_plays: "Просмотры видео",
  },
  state: {
    partial: "частично — {observed}/{requested} дней",
    failed: "не удалось прочитать",
    unavailable: "не измерено",
  },
  performance: {
    loading: "Чтение сохраненных измерений…",
    unreadable: "Измерения этого кабинета не удалось прочитать.",
    neverSynced:
      "Синхронизации еще не было. Запустите аудит рекламы, чтобы прочитать расходы и показ этого кабинета. Пока ничего не измерено — ничего не показывается.",
    syncedRange: "С {start} по {end}. Последняя синхронизация {date}.",
    metricHeader: "Метрика",
    valueHeader: "Значение",
    coverageHeader: "Покрытие",
    coverageComplete: "полное",
    metricNote: "{metric}: {note}",
  },
  wasted: {
    heading: "Запросы, требующие решения",
    loading: "Чтение сохраненных поисковых запросов…",
    empty:
      "Для этого аккаунта еще нет сохраненных поисковых запросов. Запустите аудит рекламы.",
    queryHeader: "Запрос",
    matchedHeader: "Соответствие",
    clicksHeader: "Клики",
    costHeader: "Стоимость",
    conversionsHeader: "Конверсии",
    footnote:
      "Только Поиск и Товарные кампании. Performance Max и Demand Gen вообще не сообщают запросы, а Google скрывает фразы, слишком редкие для анонимизации, поэтому здесь никогда не учитываются все клики аккаунта. Короткий список — не доказательство, что ничего не тратится впустую.",
  },
  queue: {
    heading: "Ждет вашего одобрения",
    empty:
      "Ничего не ждет одобрения. Подключенный агент может подготовить кампанию и поставить ее сюда; одобрить ее он не может, и сам продукт пока ничего не отправляет на рекламные платформы. Google Ads доступен только для чтения — так задумано, см. ADR 0008.",
    perDay: "{amount} в день",
    lifetime: "{amount} за все время",
    noBudget: "Бюджет не указан",
    stagedOne:
      "{count} подготовленный пейлоад. Прочитайте точный запрос перед одобрением — одобрение привязывается к этой версии, а пейлоад, измененный позже, придется одобрять заново.",
    stagedMany:
      "{count} подготовленных пейлоадов. Прочитайте точный запрос перед одобрением — одобрение привязывается к этой версии, а пейлоад, измененный позже, придется одобрять заново.",
    stagedBy: "Подготовил {name} {date}. Пейлоад {hash}…",
    hidePayload: "Скрыть пейлоад",
    readPayload: "Читать пейлоад",
    readBeforeApproving: "Прочитайте пейлоад, прежде чем одобрять.",
    approveExact: "Одобрить именно этот пейлоад",
    withdraw: "Отозвать",
    approvalRefused: "В одобрении отказано.",
    footnote:
      "Одобрение фиксирует ваше согласие именно с этим пейлоадом. Оно ничего не отправляет: в этой сборке нет исходящего пути записи в Meta — так задумано.",
  },
  connections: {
    heading: "Подключения",
    integrationsLink: "Интеграции",
    metaExpiredBefore:
      "Токен доступа Meta истек. Токены системного пользователя Meta имеют фиксированный срок жизни и не обновляются — создайте новый в Business Manager и вставьте его в разделе",
    metaExpiredAfter:
      ". До тех пор расходы и показы нечитаемы, а не равны нулю.",
    metaConnectedExpiry:
      "Meta подключена. Токен истекает {date} — обновите его заранее.",
    metaConnected: "Meta подключена.",
    metaMissingBefore:
      "Meta не подключена, поэтому расходы Facebook и Instagram прочитать нельзя. Создайте токен системного пользователя в Meta Business Manager и вставьте его в разделе",
    metaMissingAfter: ".",
    googleExpiredBefore:
      "Вход Google для Google Ads истек. Переподключите его в разделе",
    googleExpiredAfter:
      ". До тех пор расходы Google нечитаемы, а не равны нулю.",
    googleConnected: "Google Ads подключен.",
    googleMissingBefore:
      "Google Ads не подключен. Нужны две вещи: вход Google и ваш собственный токен разработчика из API Center управляющего аккаунта Google Ads. Marketingovo не поставляет токен разработчика — вшитый в приложение токен сделал бы каждую установку единой идентичностью для Google, а его лимиты и условия привязаны к владельцу. Новые токены Google одобряет вручную, поэтому подавайте заявку заранее. Оба указываются в разделе",
    googleMissingAfter: ".",
  },
  cabinets: {
    heading: "Рекламные кабинеты",
    providerSelectLabel: "Провайдер для поиска аккаунтов",
    asking: "Запрос к {provider}…",
    findAccounts: "Найти мои аккаунты",
    starting: "Запуск…",
    runPaidAudit: "Запустить аудит рекламы",
    auditCheckBefore:
      "Аудит рекламы также проверяет страницы, на которые эти объявления ведут людей: адреса с 404, редиректы, теряющие идентификатор клика, и посадочные, ни словом не упоминающие то, на что делается ставка. Результаты появляются в разделе",
    actionsLink: "Действия",
    auditCheckAfter:
      ". Если сначала выполнить SEO-аудит, проверка станет дешевле и получит данные о скорости страниц; без него каждая целевая страница запрашивается напрямую.",
    empty:
      "К этому рабочему пространству не привязан ни один рекламный аккаунт. Один вход обычно открывает несколько аккаунтов, и какие из них читает это рабочее пространство — ваше решение: подключение провайдера само по себе ничего не привязывает.",
    billsIn: "счета в {currency}",
    noCurrency: "валюта для этого аккаунта не сообщена",
    dailyCap: "дневной лимит {cap}",
    noDailyCap: "локальный дневной лимит не задан",
    hidePerformance: "Скрыть статистику",
    showPerformance: "Показать статистику",
    archive: "Архивировать",
    remove: "Удалить",
    removeTitle: "Удаляет кабинет и все записанные по нему измерения.",
    discoveryFailed: "Не удалось связаться с {provider} для поиска аккаунтов.",
    discoveredHeading: "Аккаунты, доступные этим учетным данным",
    linked: "Привязан",
    linkToWorkspace: "Привязать к этому рабочему пространству",
  },
};
