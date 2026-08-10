/** The catch-all route for paths the console does not serve. */
import type { MessagesFor } from "../types";

export const notFound: MessagesFor<"notFound"> = {
  title: "Página no encontrada",
  description: "Esta ruta del panel de control no existe.",
  returnToOverview: "Volver al resumen",
} as const;
