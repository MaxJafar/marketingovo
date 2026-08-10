import type { MessagesFor } from "../types";

/** The content calendar: entries, approvals, publish records, and media. */
export const contentCalendar: MessagesFor<"contentCalendar"> = {
  entry: {
    noTimeSet: "время не задано",
    attachmentSingular: "{count} вложение",
    attachmentPlural: "{count} вложений",
    sent: "Отправлено {time}",
    openPost: "открыть пост",
    indeterminate:
      "Запрос был отправлен, а ответ не записан, поэтому неизвестно, ушел ли этот пост. Проверьте {platform}, прежде чем пробовать снова — Marketingovo сам повторно не отправит.",
    refusedFallback: "Провайдер отклонил этот пост.",
    needsTimeTitle: "Задайте посту время, прежде чем одобрять.",
    approve: "Одобрить на это время",
    sending: "Отправка…",
    sendNow: "Отправить сейчас",
  },
  media: {
    title: "Медиа",
    uploadLabel: "Загрузить медиа",
    sizeKb: "{size}КБ",
    publiclyReachable:
      "Доступно публично ({source}). Instagram может это получить.",
    storedLocally:
      "Хранится только на этой машине. Telegram, X и Facebook публикуют его напрямую; Instagram не может — он забирает медиа по публичному URL, а не принимает загрузку.",
    relayTitle:
      "Загружает этот файл в настроенное вами объектное хранилище, чтобы Instagram мог его получить.",
    uploading: "Загрузка…",
    relay: "Опубликовать в мое хранилище",
    urlPlaceholder: "или вставьте публичный https:// URL на вашем хостинге",
    useUrl: "Использовать этот URL",
    uploadRefused: "Загрузка была отклонена.",
    empty:
      "Медиа пока нет. Загруженные файлы остаются на этой машине и отправляются напрямую в Telegram, X и Facebook при публикации поста.",
  },
  overdue: {
    title: "Просрочены и не отправлены",
    body: "Они были запланированы на момент, который уже прошел, и так и не были одобрены, поэтому ничего не отправлялось. Календарь, который просто рисует клетки, спрятал бы их.",
  },
  week: {
    title: "Ближайшие две недели",
    loading: "Чтение календаря…",
    emptyBefore: "Ничего не запланировано. Набросайте пост в",
    composerLink: "редакторе",
    emptyAfter:
      "или попросите подключенного агента написать его, а затем задайте время здесь.",
  },
  unscheduled: {
    title: "Черновики, ждущие времени",
    body: "Выберите время и одобрите. Смена времени уже одобренного поста снимает одобрение, потому что время — часть того, что вы одобрили.",
    timeLabel: "Запланированное время",
    schedule: "Запланировать выбранный пост",
    scheduleFailed: "Пост не удалось запланировать.",
  },
};
