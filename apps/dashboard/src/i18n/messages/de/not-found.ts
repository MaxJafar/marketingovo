import type { MessagesFor } from "../types";

/** The catch-all route for paths the console does not serve. */
export const notFound: MessagesFor<"notFound"> = {
  title: "Seite nicht gefunden",
  description: "Diese Route des Kontrollpanels existiert nicht.",
  returnToOverview: "Zurück zum Überblick",
} as const;
