import type { MessagesFor } from "../types";

/** Backlinks: the internal graph the crawler proves, and the stated boundary. */
export const backlinks: MessagesFor<"backlinks"> = {
  internalTitle: "Interne linkgraaf",
  lookingForAudit: "Zoeken naar een voltooide audit…",
  latestAuditBody:
    "De meest recente audit heeft elke interne link op de site in kaart gebracht. Open de verkenner om voor elke pagina inlinks en outlinks te volgen.",
  openExplorer: "Linkverkenner openen →",
  noAuditYet:
    "Nog geen voltooide audit. Draai er een en de interne linkgraaf verschijnt hier.",
  openAudits: "audits openen",
  externalTitle: "Externe backlinks",
  externalBody:
    "Marketingovo crawlt jouw site, niet de rest van het web, en kan verwijzende domeinen dus niet zelf meten. Er is hier geen backlinkaantal om te tonen en er wordt er ook geen geschat.",
  agentBodyBefore:
    "Een gekoppelde agent kan dit met zijn eigen tools onderzoeken. Vraag het hem in de terminal hieronder — bijvoorbeeld",
  agentExample:
    "welke sites hebben dit kwartaal naar onze prijzenpagina gelinkt",
  agentBodyAfter: ".",
} as const;
