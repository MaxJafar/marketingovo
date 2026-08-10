import type { MessagesFor } from "../types";

/** The catch-all route for paths the console does not serve. */
export const notFound: MessagesFor<"notFound"> = {
  title: "Страница не найдена",
  description: "Такого маршрута в панели управления нет.",
  returnToOverview: "Вернуться к обзору",
};
