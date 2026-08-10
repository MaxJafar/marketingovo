import type { MessagesFor } from "../types";

/** The reports library: exportable snapshots and their download formats. */
export const reports: MessagesFor<"reports"> = {
  eyebrow: "Делитесь результатами",
  title: "Отчеты",
  description:
    "Держите заинтересованных в курсе с помощью экспортируемых снимков и регулярных сводок эффективности.",
  typeFallback: "SEO-отчет",
  generated: "Сформирован {date}",
  scheduledFor: "Запланирован на {date}",
  scheduleUnavailable: "Расписание недоступно",
  recipients: "Получатели: {list}",
  downloadGroupLabel: "Скачать {name}",
  downloadFormatLabel: "Скачать отчет {format}: {name}",
  downloadUnavailable: "Скачивание недоступно",
  emptyTitle: "Отчетов пока нет",
  emptyDescription:
    "Сформируйте отчеты через API или настройте расписание, когда появятся базовые данные.",
};
