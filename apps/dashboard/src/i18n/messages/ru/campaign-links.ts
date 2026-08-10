import type { MessagesFor } from "../types";

/**
 * Campaign links and their QR codes: the builder, the live preview, stored
 * links, and the self-hosted redirect config. Conventions in shell.ts.
 */
export const campaignLinks: MessagesFor<"campaignLinks"> = {
  verdictLabel: {
    comfortable: "сканируется надежно",
    tight: "на грани",
    unscannable: "не отсканируется",
  },
  placementOption: {
    screen: { label: "Экран", hint: "Слайды, веб-страница, видео" },
    printHandheld: {
      label: "В руке",
      hint: "Флаер, визитка, чек",
    },
    printPoster: {
      label: "Постер",
      hint: "Читают с расстояния, редко трогают",
    },
    packaging: { label: "Упаковка", hint: "Изогнута, затерта при перевозке" },
    outdoor: { label: "На улице", hint: "Дождь, солнце, частично перекрыт" },
  },
  links: {
    heading: "Ссылки",
    qrAlt: "QR-код для {label}",
    printedTag: "напечатан",
    copied: "Скопировано",
    copyLink: "Копировать ссылку",
    svg: "SVG",
    png: "PNG",
    markPrinted: "Отметить как напечатанный",
    delete: "Удалить",
    noteOne: "{count} заметка со времени создания",
    noteMany: "{count} заметок со времени создания",
    empty:
      "Ссылок пока нет. Созданные здесь коды кодируют свой URL напрямую, поэтому их ничто не резолвит, и их нельзя отозвать или тарифицировать.",
  },
  form: {
    heading: "Новая ссылка кампании",
    mark: "проверяется до того, как код существует",
    intro:
      "QR-код — это URL, менять который стало дорого. Разметка проверяется здесь, пока исправление еще ничего не стоит.",
    nameLabel: "Название",
    nameHelp: "Чтобы потом найти. В URL никогда не попадает.",
    destinationLabel: "Назначение",
    destinationHelp: "Страница без меток. Разметка добавляется ниже.",
    sourceLabel: "Источник",
    sourceHelp: "Откуда пришли",
    mediumLabel: "Канал",
    mediumHelp: "Каким способом",
    campaignLabel: "Кампания",
    campaignHelp: "Какая кампания",
    normalizedBefore: "По соглашению об именовании это превращается в",
    normalizedAfter: ".",
    useThat: "Использовать это",
    placementLabel: "Где будет этот код?",
    placementHelp: "Определяет уровень коррекции ошибок и минимальный размер.",
    printedWidthLabel: "Ширина печати (мм)",
    printedWidthHelp: "Какой ширины он реально будет на готовом носителе.",
    coloursSummary: "Цвета и поля",
    modulesLabel: "Модули",
    backgroundLabel: "Фон",
    quietZoneLabel: "Тихая зона",
    quietZoneHelp: "Четыре — стандартный минимум.",
  },
  preview: {
    heading: "Предпросмотр",
    moduleSize: "Размер модуля",
    readableFrom: "Читается с",
    readableUpTo: "до {distance} см",
    contrast: "Контраст",
    symbol: "Символ",
    symbolSpec: "версия {version}, {count}×{count} модулей, уровень {level}",
    blockingHeading: "Это блокирует сохранение",
    blockingBody:
      "Все остальное в этом продукте записывает проблему и продолжает работать. Эти проверки — нет, потому что у напечатанного кода нет второй попытки.",
    advisoryHeading: "Стоит знать",
    saveFailed: "Ссылку не удалось сохранить.",
    saving: "Сохранение…",
    saveLink: "Сохранить эту ссылку",
    nameFirst: "Сначала дайте название.",
  },
  redirect: {
    heading: "Коды, которые можно перенацелить позже",
    body: "QR-код не может истечь или измениться — модули кодируют адрес назначения. Продукты, продающие «динамические» коды, продают редирект на собственном домене, поэтому они же могут перестать его обслуживать. Разместите редирект на домене, которым уже владеете, — та же возможность не стоит ничего и никому не подчиняется.",
    platformLabel: "Платформа",
    cannotExpire: "сам по себе не истекает",
    shortDomainLabel: "Ваш короткий домен",
    endsOnLabel: "Заканчивается",
    expiryNote:
      "{platform} не умеет проверять дату. Срок вписан как комментарий, и кто-то должен отредактировать файл.",
    building: "Сборка…",
    buildConfig: "Собрать конфиг",
    copy: "Копировать",
  },
};
