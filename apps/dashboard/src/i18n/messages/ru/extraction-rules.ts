import type { MessagesFor } from "../types";

/** Custom extraction rules card: editor, template library, safe live preview. */
export const extractionRules: MessagesFor<"extractionRules"> = {
  eyebrow: "Конфигурация доказательств",
  title: "Пользовательские правила извлечения",
  description:
    "Захватывайте цены, авторов, ID товаров, маркеры CMS и любые другие поля страниц при каждом аудите. Правила принадлежат этому проекту, и каждая сохраненная ревизия остается доступной для воспроизводимого повтора запуска.",
  currentRuleSet: "Текущий набор правил",
  revisionLabel: "Ревизия {revision}",
  loadingRules: "Загрузка правил извлечения…",
  preparingEditor: "Подготовка редактора извлечения…",
  rulesUnavailableTitle: "Правила извлечения недоступны",
  revisionSavedTitle: "Ревизия правил сохранена",
  revisionSavedBody:
    "Новые аудиты зафиксируют эту ревизию. Существующие запуски и их доказательства не меняются.",
  revisionRejectedTitle: "Ревизия правил отклонена",
  captureOptions: {
    text: "Текстовое содержимое",
    html: "Внутренний HTML",
    attribute: "Атрибут",
  },
  template: {
    eyebrow: "Библиотека с обязательной проверкой",
    title: "Шаблоны извлечения",
    description:
      "Начните с курируемого пакета доказательств, изучите каждый селектор, затем добавьте его в несохраненный черновик. Шаблоны сами по себе никогда не записывают ревизию и не запускают обход.",
    policyPill: "Требуется проверка",
    loading: "Загрузка шаблонов извлечения…",
    catalogUnavailableTitle: "Каталог шаблонов недоступен",
    gridLabel: "Шаблоны",
    review: "Проверить {name}",
    fieldsCount: "{count} полей",
    addedTitle: "Шаблон добавлен в черновик",
    addedBody:
      "Поля {name} готовы к проверке или предпросмотру ниже. Ничего не сохраняется, пока вы не укажете описание ревизии и не нажмете Сохранить ревизию.",
    reviewEyebrow: "Проверка импорта в черновик",
    closeReview: "Закрыть проверку",
    previewOn: "Предпросмотр на",
    beforeSaving: "Перед сохранением",
    beforeSavingBody:
      "Просмотрите репрезентативный URL и удалите или переименуйте поля, которые не подходят этому сайту.",
    assumptionsLabel: "Допущения для проверки",
    fieldsTable: "Поля {name}",
    fieldColumn: "Поле",
    selectorColumn: "CSS-селектор",
    captureColumn: "Захват",
    attributeCapture: "Атрибут: {attribute}",
    conflictTitle: "Разрешите конфликты полей",
    conflictBodyOne:
      "Переименуйте или удалите существующее поле черновика: {labels}. Метки шаблона должны оставаться уникальными.",
    conflictBodyMany:
      "Переименуйте или удалите существующие поля черновика: {labels}. Метки шаблона должны оставаться уникальными.",
    capacityTitle: "Превышен лимит правил",
    capacityBody:
      "Этот пакет превысит границу проекта в 50 правил. Удалите правила из черновика перед его импортом.",
    addFieldsOne: "Добавить {count} поле в черновик",
    addFieldsMany: "Добавить {count} полей в черновик",
    freshIdsNote:
      "Новые ID правил создаются локально; ID каталога никогда не сохраняются как пользовательская конфигурация.",
  },
  editor: {
    listLabel: "Правила извлечения",
    empty:
      "Правил пока нет. Добавьте одно, чтобы превратить данные конкретных страниц в проверяемые доказательства.",
    ruleLegend: "Правило {number}",
    enabled: "Включено",
    removeRule: "Удалить правило {number}",
    remove: "Удалить",
    fieldLabel: "Метка поля",
    capture: "Захват",
    cssSelector: "CSS-селектор",
    attributeName: "Имя атрибута",
    regexLabel: "Безопасный regex-фильтр",
    regexOptional: "(необязательно)",
    regexHelp:
      "Если есть группа захвата 1, сохраняется она. Обратные ссылки, lookaround и неоднозначные повторы отклоняются.",
    addRule: "Добавить правило",
    revisionSummary: "Описание ревизии",
    savingRevision: "Сохранение ревизии…",
    saveRevision: "Сохранить ревизию",
  },
  preview: {
    title: "Безопасный живой предпросмотр",
    description:
      "Загрузите один URL точно на origin проекта через ту же политику исходящего трафика с учетом редиректов, что и у аудитов. Предпросмотр никогда не сохраняет черновики правил.",
    failedTitle: "Предпросмотр не удался",
    pageUrl: "URL страницы",
    rendering: "Рендеринг",
    renderOptions: {
      static: "Статический HTML",
      js: "JavaScript",
    },
    allowPrivateHost: "Разрешить именно этот приватный хост",
    allowPrivateHostHelp:
      "Нужно только для localhost или одобренного внутреннего сайта. Адреса облачных метаданных остаются заблокированными.",
    renderingPreview: "Рендеринг предпросмотра…",
    previewDraft: "Предпросмотр черновика",
    httpStatus: "HTTP {status}",
    responseTime: "{ms} мс",
    finalUrl: "Конечный URL",
    resultsTable: "Результаты предпросмотра извлечения",
    fieldColumn: "Поле",
    resultColumn: "Результат",
    noMatch: "Нет совпадения",
    truncated: "Значение обрезано на границе доказательств.",
  },
};
