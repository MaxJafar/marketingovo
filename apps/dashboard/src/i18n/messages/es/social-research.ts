/** Social research: honest source status and where measured data lives. */
import type { MessagesFor } from "../types";

export const socialResearch: MessagesFor<"socialResearch"> = {
  status: {
    title: "Estado de las fuentes",
    connectedSingular:
      "{count} fuente social conectada para publicar. La escucha — menciones, sentimiento, interacción — aún no tiene recolector, así que nada de ese tipo se mide ni se muestra.",
    connectedPlural:
      "{count} fuentes sociales conectadas para publicar. La escucha — menciones, sentimiento, interacción — aún no tiene recolector, así que nada de ese tipo se mide ni se muestra.",
    none: "No hay ninguna fuente social conectada, y la escucha social aún no tiene recolector — así que esta página no muestra ninguna cifra de menciones o sentimiento en lugar de inventarla.",
    connectLink: "conectar una fuente",
  },
  measured: {
    title: "Qué se mide hoy",
    body: "La publicación se mide de principio a fin: cada publicación preparada en el calendario conserva un registro inmutable de la solicitud exacta enviada a cada plataforma, y el informe multicanal cuenta los envíos publicados, rechazados e indeterminados por plataforma.",
    openCalendar: "Abrir el calendario →",
    openReport: "Verlo en el informe →",
  },
  agent: {
    title: "Pregunta al agente",
    bodyBefore:
      "La escucha social aún no es un recolector de Marketingovo. Un agente conectado todavía puede investigarlo por ti con sus propias herramientas — prueba a pedírselo en la terminal de abajo, por ejemplo",
    examplePrompt:
      "resume lo que la gente dijo sobre nosotros en Reddit este mes",
    bodyAfter: ".",
  },
} as const;
