import type { MessagesFor } from "../types";

/** Backlinks: the internal graph the crawler proves, and the stated boundary. */
export const backlinks: MessagesFor<"backlinks"> = {
  internalTitle: "Interner Link-Graph",
  lookingForAudit: "Suche nach einem abgeschlossenen Audit…",
  latestAuditBody:
    "Das jüngste Audit hat jeden internen Link der Site kartiert. Öffne seinen Explorer, um Inlinks und Outlinks jeder Seite nachzuverfolgen.",
  openExplorer: "Link-Explorer öffnen →",
  noAuditYet:
    "Noch kein abgeschlossenes Audit. Starte eines, und der interne Link-Graph erscheint hier.",
  openAudits: "Audits öffnen",
  externalTitle: "Externe Backlinks",
  externalBody:
    "Marketingovo crawlt deine Site, nicht den Rest des Webs, und kann verweisende Domains daher nicht selbst messen. Es gibt hier keine Backlink-Zahl zu zeigen, und keine wird geschätzt.",
  agentBodyBefore:
    "Ein angebundener Agent kann das mit seinen eigenen Tools recherchieren. Frag ihn im Terminal unten — zum Beispiel",
  agentExample:
    "welche Sites haben dieses Quartal auf unsere Preisseite verlinkt",
  agentBodyAfter: ".",
} as const;
