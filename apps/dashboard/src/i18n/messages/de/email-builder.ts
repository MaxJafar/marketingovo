import type { MessagesFor } from "../types";

/** The email builder: brand kit, templates, compiler report, and preview. */
export const emailBuilder: MessagesFor<"emailBuilder"> = {
  report: {
    title: "Was E-Mail-Clients damit machen werden",
    okSummary: "Nichts Blockierendes oder Kaputtes. {size} KB kompiliert",
    okNoWarnings: ".",
    okWarningSingular: ", mit {count} lesenswerten Warnung.",
    okWarningPlural: ", mit {count} lesenswerten Warnungen.",
    blockingRemoved:
      "{count} Element(e) wurden aus dem entfernt, was du eingereicht hast — das Dokument, das du hast, ist also nicht das, das du geschrieben hast. ",
    errorSingular:
      "{count} Fehler wird in mindestens einem Client sichtbar kaputtgehen.",
    errorPlural:
      "{count} Fehler werden in mindestens einem Client sichtbar kaputtgehen.",
  },
  brandKit: {
    title: "Brand-Kit",
    revisionMark: "Revision {revision}",
    notSetUp: "nicht eingerichtet",
    intro:
      "Wogegen ein Agent E-Mails schreibt und worauf der Compiler das Ergebnis prüft. Die Postadresse und der Abmelde-Tag sind kein Styling: Kommerzielle E-Mail muss beides von Gesetzes wegen tragen.",
    colours: "Farben",
    colourNameLabel: "Name von Farbe {number}",
    colourValueLabel: "Wert von Farbe {number}",
    noStatedUse: "kein angegebener Zweck",
    type: "Typografie",
    fontStackLabel: "{role}-Font-Stack",
    fontStackHelp:
      "Beende jeden Stack mit einer generischen Familie. Outlook und Gmails Mobile-Apps ignorieren Webfonts, und ohne Fallback wählen sie ihren eigenen Standard.",
    legalFooter: "Rechtlicher Footer",
    companyName: "Firmenname",
    postalAddress: "Postadresse",
    unsubscribeLabel: "Abmelde-Merge-Tag",
    unsubHelpBefore:
      "Der Abmelde-Tag ist das, was dein E-Mail-Dienst einsetzt — Mailchimp nutzt",
    unsubHelpMiddle: ", die meisten anderen eine",
    unsubHelpAfter:
      "Form. Wortgetreu gespeichert, denn ihn zu raten erzeugt einen toten Link an einer gesetzlich vorgeschriebenen Stelle.",
    voice: "Stimme",
    voicePlaceholder:
      "Wie die Marke klingt. Gelesen vom Agenten, der die Texte schreibt.",
    voiceLabel: "Markenstimme",
    changeSummaryPlaceholder: "Was sich geändert hat, und warum",
    changeSummaryLabel: "Änderungszusammenfassung",
    saveRevision: "Revision speichern",
    revisionNote:
      "Jedes Speichern hängt eine Revision an. Eine im letzten Quartal gebaute E-Mail kann noch sagen, gegen welche Marke sie gebaut wurde.",
  },
  templates: {
    title: "Templates",
    newNameLabel: "Name des neuen Templates",
    create: "Erstellen",
    empty:
      "Noch keine Templates. Erstelle eines und schreibe dann hier das HTML — oder bitte einen angebundenen Agenten, es gegen dein Brand-Kit zu entwerfen.",
    noRevisions: "noch keine Revisionen",
    revisionMeta: "Revision {revision} · aktualisiert {time}",
  },
  compose: {
    title: "Verfassen",
    starterTitle:
      "Ein tabellenbasiertes Dokument, bereits aus deinem Brand-Kit gebaut, das jede Prüfung besteht.",
    starter: "Mit dem Brand-Kit starten",
    checking: "Wird geprüft…",
    check: "Prüfen",
    saveRevision: "Revision speichern",
    subject: "Betreff",
    preheaderPlaceholder:
      "Preheader — die Zeile, die das Postfach nach dem Betreff zeigt",
    preheaderLabel: "Preheader",
    emailHtml: "E-Mail-HTML",
    compileFailed: "Die E-Mail konnte nicht kompiliert werden.",
  },
  preview: {
    title: "Vorschau",
    desktop: "Desktop",
    mobile: "Mobil",
    frameTitle: "E-Mail-Vorschau",
    compiledSummary: "Kompiliertes HTML — das ist, was du exportierst",
    plainTextSummary: "Nur-Text-Alternative",
    exportNote:
      "Marketingovo versendet keine E-Mail. Kopiere das kompilierte HTML in deinen eigenen E-Mail-Dienst, dem bereits deine Liste, deine Einwilligungen und deine Abmeldeverwaltung gehören.",
  },
} as const;
