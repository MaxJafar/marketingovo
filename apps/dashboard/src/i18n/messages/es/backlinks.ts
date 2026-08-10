/** Backlinks: the internal graph the crawler proves, and the stated boundary. */
import type { MessagesFor } from "../types";

export const backlinks: MessagesFor<"backlinks"> = {
  internalTitle: "Grafo de enlaces internos",
  lookingForAudit: "Buscando una auditoría completada…",
  latestAuditBody:
    "La auditoría más reciente mapeó todos los enlaces internos del sitio. Abre su explorador para rastrear los enlaces entrantes y salientes de cualquier página.",
  openExplorer: "Abrir el explorador de enlaces →",
  noAuditYet:
    "Aún no hay una auditoría completada. Ejecuta una y el grafo de enlaces internos aparecerá aquí.",
  openAudits: "abrir auditorías",
  externalTitle: "Backlinks externos",
  externalBody:
    "Marketingovo rastrea tu sitio, no el resto de la web, así que no puede medir dominios de referencia por sí solo. No hay ninguna cifra de backlinks que mostrar aquí y ninguna se estima.",
  agentBodyBefore:
    "Un agente conectado puede investigar esto con sus propias herramientas. Pídeselo en la terminal de abajo — por ejemplo",
  agentExample:
    "qué sitios enlazaron a nuestra página de precios este trimestre",
  agentBodyAfter: ".",
} as const;
