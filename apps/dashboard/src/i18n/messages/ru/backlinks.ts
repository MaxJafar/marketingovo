import type { MessagesFor } from "../types";

/** Backlinks: the internal graph the crawler proves, and the stated boundary. */
export const backlinks: MessagesFor<"backlinks"> = {
  internalTitle: "Граф внутренних ссылок",
  lookingForAudit: "Поиск завершенного аудита…",
  latestAuditBody:
    "Последний аудит отобразил каждую внутреннюю ссылку на сайте. Откройте его обозреватель, чтобы проследить входящие и исходящие ссылки любой страницы.",
  openExplorer: "Открыть обозреватель ссылок →",
  noAuditYet:
    "Завершенного аудита пока нет. Запустите один — и граф внутренних ссылок появится здесь.",
  openAudits: "открыть аудиты",
  externalTitle: "Внешние обратные ссылки",
  externalBody:
    "Marketingovo обходит ваш сайт, а не остальной веб, поэтому сам он не может измерить ссылающиеся домены. Показывать здесь нечего, и никакая цифра не оценивается приблизительно.",
  agentBodyBefore:
    "Подключенный агент может исследовать это своими инструментами. Спросите его в терминале ниже — например",
  agentExample: "какие сайты ссылались на нашу страницу цен в этом квартале",
  agentBodyAfter: ".",
};
