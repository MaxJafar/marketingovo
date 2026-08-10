import type { MessagesFor } from "../types";

/**
 * The cross-channel report: generation, stored snapshots, section panels,
 * charts, and coverage gaps. Conventions in shell.ts.
 */
export const marketingReport: MessagesFor<"marketingReport"> = {
  stateLabel: {
    available: "volledig",
    partial: "gedeeltelijke dekking",
    unavailable: "niet gemeten",
    failed: "kon niet worden gelezen",
  },
  breakdownTitle: {
    paid: "Uitgaven per account en platform",
    social: "Gepubliceerde posts per platform",
    competitors: "Publieke signalen per concurrent",
  },
  changeVsPrevious: "{change}% t.o.v. vorige periode",
  notMeasuredPeriod: "Niet gemeten in deze periode.",
  compareHeading: "Deze periode tegenover de vorige",
  fellToZero:
    "Viel terug naar nul ten opzichte van de vorige periode; het paar kan niet uit de opgeslagen cijfers worden getekend.",
  notDrawn: "Niet getekend — {label}: {reason}",
  breakdownHeading: "Uitsplitsing",
  notMeasuredCell: "niet gemeten",
  sourcesPrefix: "Bronnen:",
  sourceEntry: "{label} ({state}{reason})",
  noNarrative:
    "Nog geen toelichting. Schrijf er een, of vraag het een gekoppelde agent — een samenvatting die uit de cijfers is opgebouwd leest als inzicht terwijl het rekenwerk is, dus die wordt bewust niet gegenereerd.",
  openClientVersion: "Open de klantversie",
  plainText: "Platte tekst",
  downloadPdf: "PDF downloaden",
  gapsHeading: "Wat dit rapport niet kon zien",
  gapsBody:
    "Hier verzameld en ook per sectie, zodat een lezer die de cijfers scant de gaten alsnog tegenkomt.",
  generateHeading: "Rapport genereren",
  periodStart: "Begin periode",
  periodEnd: "Einde periode",
  gathering: "Verzamelen…",
  generate: "Genereren",
  description:
    "Beslaat betaald, organisch zoeken, socialpublicaties, e-mail, het concurrentielandschap en afgerond werk — met grafieken voor wat gemeten is en een downloadbare PDF. Laat de datums leeg voor de laatste volledige 30 dagen — de huidige dag wordt uitgesloten omdat providers die achteraf bijstellen.",
  generateFailed: "Het rapport kon niet worden gegenereerd.",
  generatedOn: "· gegenereerd {date}",
  empty:
    "Nog geen rapporten. Een opgeslagen rapport is een bevroren snapshot — cijfers staan er zoals elk platform ze die dag rapporteerde en worden achteraf niet bijgesteld.",
} as const;
