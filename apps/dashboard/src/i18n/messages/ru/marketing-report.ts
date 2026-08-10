import type { MessagesFor } from "../types";

/**
 * The cross-channel report: generation, stored snapshots, section panels,
 * charts, and coverage gaps. Conventions in shell.ts.
 */
export const marketingReport: MessagesFor<"marketingReport"> = {
  stateLabel: {
    available: "полностью",
    partial: "частичное покрытие",
    unavailable: "не измерено",
    failed: "не удалось прочитать",
  },
  breakdownTitle: {
    paid: "Расходы по аккаунтам и платформам",
    social: "Опубликованные посты по платформам",
    competitors: "Публичные сигналы по конкурентам",
  },
  changeVsPrevious: "{change}% к предыдущему периоду",
  notMeasuredPeriod: "В этом периоде не измерялось.",
  compareHeading: "Этот период против предыдущего",
  fellToZero:
    "Упало до нуля относительно предыдущего периода; пару нельзя построить из сохраненных значений.",
  notDrawn: "Не построено — {label}: {reason}",
  breakdownHeading: "Разбивка",
  notMeasuredCell: "не измерено",
  sourcesPrefix: "Источники:",
  sourceEntry: "{label} ({state}{reason})",
  noNarrative:
    "Нарратива пока нет. Напишите его или попросите подключенного агента — сводка, собранная из чисел, читается как инсайт, оставаясь арифметикой, поэтому она намеренно не генерируется.",
  openClientVersion: "Открыть клиентскую версию",
  plainText: "Обычный текст",
  downloadPdf: "Скачать PDF",
  gapsHeading: "Чего этот отчет не увидел",
  gapsBody:
    "Собрано здесь и в каждом разделе, чтобы читатель, пробегающий цифры, все равно встретил пробелы.",
  generateHeading: "Сформировать отчет",
  periodStart: "Начало периода",
  periodEnd: "Конец периода",
  gathering: "Сбор…",
  generate: "Сформировать",
  description:
    "Охватывает платный трафик, органический поиск, публикации в соцсетях, почту, конкурентный ландшафт и завершенную работу — с графиками для измеренного и скачиваемым PDF. Оставьте даты пустыми для последних полных 30 дней — текущий день исключается, потому что провайдеры его пересчитывают.",
  generateFailed: "Отчет не удалось сформировать.",
  generatedOn: "· сформирован {date}",
  empty:
    "Отчетов пока нет. Сохраненный отчет — замороженный снимок: цифры такие, какими платформы сообщили их в тот день, и задним числом не пересчитываются.",
};
