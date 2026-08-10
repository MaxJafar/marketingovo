/** The catch-all route for paths the console does not serve. */
import type { MessagesFor } from "../types";

export const notFound: MessagesFor<"notFound"> = {
  title: "Səhifə tapılmadı",
  description: "Belə bir idarəetmə paneli marşrutu mövcud deyil.",
  returnToOverview: "Ümumi baxışa qayıt",
};
