import type { MessagesFor } from "../types";

/** The email builder: brand kit, templates, compiler report, and preview. */
export const emailBuilder: MessagesFor<"emailBuilder"> = {
  report: {
    title: "Что с этим сделают почтовые клиенты",
    okSummary: "Ничего блокирующего или сломанного. Скомпилировано {size}КБ",
    okNoWarnings: ".",
    okWarningSingular: ", с {count} предупреждением, которое стоит прочитать.",
    okWarningPlural: ", с {count} предупреждениями, которые стоит прочитать.",
    blockingRemoved:
      "{count} элемент(ов) удалено из отправленного, поэтому документ у вас — не тот, что вы написали. ",
    errorSingular:
      "{count} ошибка заметно сломает письмо минимум в одном клиенте.",
    errorPlural:
      "{count} ошибок заметно сломают письмо минимум в одном клиенте.",
  },
  brandKit: {
    title: "Бренд-кит",
    revisionMark: "ревизия {revision}",
    notSetUp: "не настроен",
    intro:
      "То, на что опирается агент при написании писем и на что компилятор проверяет результат. Почтовый адрес и тег отписки — не оформление: коммерческая рассылка по закону обязана содержать оба.",
    colours: "Цвета",
    colourNameLabel: "Название цвета {number}",
    colourValueLabel: "Значение цвета {number}",
    noStatedUse: "назначение не указано",
    type: "Типографика",
    fontStackLabel: "Стек шрифтов: {role}",
    fontStackHelp:
      "Завершайте каждый стек универсальным семейством. Outlook и мобильные приложения Gmail игнорируют веб-шрифты, и без запасного варианта они подставляют собственный шрифт по умолчанию.",
    legalFooter: "Юридический подвал",
    companyName: "Название компании",
    postalAddress: "Почтовый адрес",
    unsubscribeLabel: "Merge-тег отписки",
    unsubHelpBefore:
      "Тег отписки — это то, что подставляет ваш почтовый сервис: Mailchimp использует",
    unsubHelpMiddle: ", у большинства других это форма вида",
    unsubHelpAfter:
      ". Хранится дословно, потому что попытка угадать дает мертвую ссылку в юридически обязательном месте.",
    voice: "Голос",
    voicePlaceholder:
      "Как звучит бренд. Это читает агент, который пишет тексты.",
    voiceLabel: "Голос бренда",
    changeSummaryPlaceholder: "Что изменилось и почему",
    changeSummaryLabel: "Описание изменений",
    saveRevision: "Сохранить ревизию",
    revisionNote:
      "Каждое сохранение добавляет ревизию. Письмо, собранное в прошлом квартале, все еще может сказать, под какой бренд его собирали.",
  },
  templates: {
    title: "Шаблоны",
    newNameLabel: "Название нового шаблона",
    create: "Создать",
    empty:
      "Шаблонов пока нет. Создайте один и напишите HTML здесь или попросите подключенного агента набросать его по вашему бренд-киту.",
    noRevisions: "ревизий пока нет",
    revisionMeta: "ревизия {revision} · обновлено {time}",
  },
  compose: {
    title: "Составление",
    starterTitle:
      "Табличный документ, уже собранный из вашего бренд-кита и проходящий все проверки.",
    starter: "Начать с бренд-кита",
    checking: "Проверка…",
    check: "Проверить",
    saveRevision: "Сохранить ревизию",
    subject: "Тема",
    preheaderPlaceholder:
      "Прехедер — строка, которую почтовый ящик показывает после темы",
    preheaderLabel: "Прехедер",
    emailHtml: "HTML письма",
    compileFailed: "Письмо не удалось скомпилировать.",
  },
  preview: {
    title: "Предпросмотр",
    desktop: "Десктоп",
    mobile: "Мобильный",
    frameTitle: "Предпросмотр письма",
    compiledSummary: "Скомпилированный HTML — именно это вы экспортируете",
    plainTextSummary: "Текстовая альтернатива",
    exportNote:
      "Marketingovo не отправляет письма. Скопируйте скомпилированный HTML в собственный почтовый сервис — у него уже есть ваш список, записи о согласии и обработка отписок.",
  },
};
