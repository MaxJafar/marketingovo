import type { MessagesFor } from "../types";

/** Social research: honest source status and where measured data lives. */
export const socialResearch: MessagesFor<"socialResearch"> = {
  status: {
    title: "Bronstatus",
    connectedSingular:
      "{count} socialbron verbonden voor publiceren. Listening — vermeldingen, sentiment, engagement — heeft nog geen collector, dus niets van dien aard wordt gemeten of getoond.",
    connectedPlural:
      "{count} socialbronnen verbonden voor publiceren. Listening — vermeldingen, sentiment, engagement — heeft nog geen collector, dus niets van dien aard wordt gemeten of getoond.",
    none: "Er is geen socialbron verbonden, en social listening heeft nog geen collector — dus deze pagina toont helemaal geen vermeldings- of sentimentcijfers in plaats van ze te verzinnen.",
    connectLink: "verbind een bron",
  },
  measured: {
    title: "Wat vandaag wordt gemeten",
    body: "Publiceren wordt van begin tot eind gemeten: elke post die in de kalender is klaargezet houdt een onveranderlijk record bij van het exacte verzoek dat naar elk platform is verstuurd, en het cross-channelrapport telt gepubliceerde, geweigerde en onbesliste verzendingen per platform.",
    openCalendar: "Open de kalender →",
    openReport: "Bekijk het in het rapport →",
  },
  agent: {
    title: "Vraag het de agent",
    bodyBefore:
      "Social listening is nog geen Marketingovo-collector. Een gekoppelde agent kan dit wel voor je onderzoeken met zijn eigen tools — probeer het hem te vragen in de terminal hieronder, bijvoorbeeld",
    examplePrompt: "vat samen wat mensen deze maand over ons zeiden op Reddit",
    bodyAfter: ".",
  },
} as const;
