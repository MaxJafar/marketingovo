import type { MessagesFor } from "../types";

/** Monitoring page: the schedule editor, schedule list, and alert stream. */
export const monitoring: MessagesFor<"monitoring"> = {
  eyebrow: "Постоянный контроль",
  title: "Мониторинг",
  description:
    "Планируйте локальные аудиты и выявляйте регрессии до того, как они станут сюрпризами в отчетах. Расписания выполняются, пока активен фоновый сервис Marketingovo.",
  mutationErrorTitle: "Изменение расписания не удалось",
  editor: {
    editTitle: "Изменить расписание",
    createTitle: "Создать расписание",
    intro:
      "Запускайте аудит сайта или формируйте кросс-канальный отчет в удобном маркетологу ритме — или используйте стандартное пятипольное cron-выражение.",
    cancelEdit: "Отменить правку",
    workflowLabel: "Что запускать",
    workflowAudit: "Аудит сайта",
    workflowReport: "Кросс-канальный отчет",
    workflowAsCreated: "{workflow} (как при создании)",
    frequencyLabel: "Частота",
    frequencyDaily: "Ежедневно",
    frequencyWeekly: "Еженедельно",
    frequencyMonthly: "Ежемесячно (1-го)",
    frequencyCustom: "Свой cron",
    cronLabel: "Cron-выражение",
    timeLabel: "Локальное время",
    dayLabel: "День",
    timezoneLabel: "Часовой пояс",
    reportNoticeTitle: "Отчеты цитируют аудиты",
    reportNoticeBody:
      "Отчет ссылается только на аудит, выполненный внутри его периода. Соедините расписание отчета с расписанием аудита, иначе его органический раздел сообщит, что измерений не было.",
    saving: "Сохранение…",
    save: "Сохранить расписание",
    create: "Создать расписание",
  },
  weekdays: {
    monday: "Понедельник",
    tuesday: "Вторник",
    wednesday: "Среда",
    thursday: "Четверг",
    friday: "Пятница",
    saturday: "Суббота",
    sunday: "Воскресенье",
  },
  cadenceMonthly: "Ежемесячно 1-го числа в {time}",
  cadenceDaily: "Ежедневно в {time}",
  cadenceWeekly: "Еженедельно: {weekday} в {time}",
  cadenceDayFallback: "день {day}",
  schedules: {
    title: "Расписания",
    description: "Устойчивые расписания аудитов для этого проекта.",
    pauseAria: "Приостановить расписание {name}",
    enableAria: "Включить расписание {name}",
    timezoneUnavailable: "Часовой пояс недоступен",
    nextRun: "Следующий: {date}",
    edit: "Изменить",
    delete: "Удалить",
    deleteConfirm: "Удалить расписание {name}?",
    emptyTitle: "Расписаний нет",
    emptyDescription:
      "Создайте расписание выше, чтобы повторять аудиты, пока активен фоновый сервис.",
  },
  alerts: {
    title: "Недавние оповещения",
    description: "Открытые и принятые изменения, требующие разбора.",
    noDetail: "Дополнительных деталей не возвращено.",
    status: "Статус: {status}",
    emptyTitle: "Оповещений мониторинга нет",
    emptyDescription:
      "Корректно пустой поток оповещений означает, что оповещений не возвращено, — а не то, что каждый источник здоров.",
  },
};
