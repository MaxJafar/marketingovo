import type { MessagesFor } from "../types";

/** Content intel: measured gaps against competitors, and topic clusters. */
export const contentIntel: MessagesFor<"contentIntel"> = {
  gaps: {
    title: "Контентные пробелы",
    loading: "Чтение сравнения…",
    empty:
      "Контентных пробелов пока не записано. Добавьте конкурентов и запустите сравнение, чтобы заполнить этот раздел.",
    emptyLink: "открыть конкурентов",
    coveredSingular: "покрыто {count} источником",
    coveredPlural: "покрыто {count} источниками",
    density: "плотность {value}",
    tag: "Пробел",
  },
  clusters: {
    title: "Тематические кластеры",
    loading: "Чтение рабочего пространства ключевых слов…",
    empty:
      "Кластеров пока нет. Сформируйте контент-план из лаборатории ключевых слов.",
    emptyLink: "открыть лабораторию ключевых слов",
    cluster: "Кластер",
    keywords: "Ключевые слова",
    coverage: "Покрытие",
  },
};
