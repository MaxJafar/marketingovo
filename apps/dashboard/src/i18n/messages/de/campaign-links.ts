import type { MessagesFor } from "../types";

/**
 * Campaign links and their QR codes: the builder, the live preview, stored
 * links, and the self-hosted redirect config. Conventions in shell.ts.
 */
export const campaignLinks: MessagesFor<"campaignLinks"> = {
  verdictLabel: {
    comfortable: "scannt zuverlässig",
    tight: "grenzwertig",
    unscannable: "wird nicht scannen",
  },
  placementOption: {
    screen: { label: "Bildschirm", hint: "Folien, eine Webseite, ein Video" },
    printHandheld: {
      label: "In der Hand",
      hint: "Flyer, Visitenkarte, Kassenbon",
    },
    printPoster: {
      label: "Poster",
      hint: "Aus der Distanz gelesen, selten berührt",
    },
    packaging: {
      label: "Verpackung",
      hint: "Gewölbt, beim Transport verkratzt",
    },
    outdoor: {
      label: "Draußen",
      hint: "Regen, Sonne, teils verdeckt",
    },
  },
  links: {
    heading: "Links",
    qrAlt: "QR-Code für {label}",
    printedTag: "gedruckt",
    copied: "Kopiert",
    copyLink: "Link kopieren",
    svg: "SVG",
    png: "PNG",
    markPrinted: "Als gedruckt markieren",
    delete: "Löschen",
    noteOne: "{count} Notiz aus der Zeit der Erstellung",
    noteMany: "{count} Notizen aus der Zeit der Erstellung",
    empty:
      "Noch keine Links. Hier erstellte Codes kodieren ihre URL direkt — nichts löst sie auf, und sie lassen sich weder widerrufen noch messen.",
  },
  form: {
    heading: "Neuer Kampagnen-Link",
    mark: "geprüft, bevor der Code existiert",
    intro:
      "Ein QR-Code ist eine URL, deren Änderung teuer gemacht wurde. Das Tagging wird hier geprüft, solange die Korrektur noch nichts kostet.",
    nameLabel: "Name",
    nameHelp: "Zum späteren Wiederfinden. Erscheint nie in der URL.",
    destinationLabel: "Ziel",
    destinationHelp: "Die ungetaggte Seite. Das Tagging kommt unten dazu.",
    sourceLabel: "Source",
    sourceHelp: "Woher es kam",
    mediumLabel: "Medium",
    mediumHelp: "Wie es ankam",
    campaignLabel: "Kampagne",
    campaignHelp: "Welche Kampagne",
    normalizedBefore: "Nach der Konvention wird daraus",
    normalizedAfter: ".",
    useThat: "Das übernehmen",
    placementLabel: "Wo wird dieser Code sein?",
    placementHelp: "Bestimmt das Fehlerkorrektur-Level und die Mindestgröße.",
    printedWidthLabel: "Druckbreite (mm)",
    printedWidthHelp:
      "Wie breit er auf dem fertigen Stück tatsächlich sein wird.",
    coloursSummary: "Farben und Rand",
    modulesLabel: "Module",
    backgroundLabel: "Hintergrund",
    quietZoneLabel: "Ruhezone",
    quietZoneHelp: "Vier ist das übliche Minimum.",
  },
  preview: {
    heading: "Vorschau",
    moduleSize: "Modulgröße",
    readableFrom: "Lesbar aus",
    readableUpTo: "bis zu {distance} cm",
    contrast: "Kontrast",
    symbol: "Symbol",
    symbolSpec: "Version {version}, {count}×{count} Module, Level {level}",
    blockingHeading: "Diese verhindern das Speichern",
    blockingBody:
      "Alles andere in diesem Produkt protokolliert ein Problem und macht weiter. Diese hier nicht, denn ein gedruckter Code hat keinen zweiten Versuch.",
    advisoryHeading: "Gut zu wissen",
    saveFailed: "Der Link konnte nicht gespeichert werden.",
    saving: "Wird gespeichert…",
    saveLink: "Diesen Link speichern",
    nameFirst: "Gib ihm zuerst einen Namen.",
  },
  redirect: {
    heading: "Codes, die du später umleiten kannst",
    body: "Ein QR-Code kann weder ablaufen noch sich ändern — die Module kodieren das Ziel. Produkte, die „dynamische“ Codes verkaufen, verkaufen einen Redirect auf ihrer eigenen Domain — weshalb sie ihn auch abschalten können. Lege den Redirect auf eine Domain, die dir schon gehört, und dieselbe Fähigkeit kostet nichts und gehorcht niemandem.",
    platformLabel: "Plattform",
    cannotExpire: "kann nicht von selbst ablaufen",
    shortDomainLabel: "Deine Kurz-Domain",
    endsOnLabel: "Endet am",
    expiryNote:
      "{platform} kann kein Datum prüfen. Das Ablaufdatum steht als Kommentar drin, und etwas muss die Datei bearbeiten.",
    building: "Wird erstellt…",
    buildConfig: "Config erstellen",
    copy: "Kopieren",
  },
} as const;
