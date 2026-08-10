import type { MessagesFor } from "../types";

/** The catch-all route for paths the console does not serve. */
export const notFound: MessagesFor<"notFound"> = {
  title: "Pagina niet gevonden",
  description: "Deze route van het bedieningspaneel bestaat niet.",
  returnToOverview: "Terug naar het overzicht",
} as const;
