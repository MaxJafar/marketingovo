import type { MessagesFor } from "../types";

/**
 * Campaign links and their QR codes: the builder, the live preview, stored
 * links, and the self-hosted redirect config. Conventions in shell.ts.
 */
export const campaignLinks: MessagesFor<"campaignLinks"> = {
  verdictLabel: {
    comfortable: "scant betrouwbaar",
    tight: "marginaal",
    unscannable: "zal niet scannen",
  },
  placementOption: {
    screen: { label: "Scherm", hint: "Slides, een webpagina, een video" },
    printHandheld: {
      label: "In de hand",
      hint: "Flyer, visitekaartje, kassabon",
    },
    printPoster: {
      label: "Poster",
      hint: "Van afstand gelezen, zelden aangeraakt",
    },
    packaging: {
      label: "Verpakking",
      hint: "Gebogen, bekrast tijdens transport",
    },
    outdoor: { label: "Buiten", hint: "Regen, zon, deels geblokkeerd" },
  },
  links: {
    heading: "Links",
    qrAlt: "QR-code voor {label}",
    printedTag: "gedrukt",
    copied: "Gekopieerd",
    copyLink: "Link kopiëren",
    svg: "SVG",
    png: "PNG",
    markPrinted: "Markeren als gedrukt",
    delete: "Verwijderen",
    noteOne: "{count} notitie van toen dit is gemaakt",
    noteMany: "{count} notities van toen dit is gemaakt",
    empty:
      "Nog geen links. Codes die hier worden gemaakt coderen hun URL rechtstreeks, dus niets lost ze op en ze kunnen niet worden ingetrokken of gemeten.",
  },
  form: {
    heading: "Nieuwe campagnelink",
    mark: "gecontroleerd voordat de code bestaat",
    intro:
      "Een QR-code is een URL die duur is gemaakt om te wijzigen. De tagging wordt hier gecontroleerd, zolang herstellen nog niets kost.",
    nameLabel: "Naam",
    nameHelp: "Om hem later terug te vinden. Verschijnt nooit in de URL.",
    destinationLabel: "Bestemming",
    destinationHelp: "De ongetagde pagina. De tagging komt hieronder.",
    sourceLabel: "Bron",
    sourceHelp: "Waar hij vandaan kwam",
    mediumLabel: "Medium",
    mediumHelp: "Hoe hij binnenkwam",
    campaignLabel: "Campagne",
    campaignHelp: "Welke campagne",
    normalizedBefore: "Volgens de conventie wordt dit",
    normalizedAfter: ".",
    useThat: "Gebruik dat",
    placementLabel: "Waar komt deze code te staan?",
    placementHelp: "Bepaalt het foutcorrectieniveau en de minimale grootte.",
    printedWidthLabel: "Drukbreedte (mm)",
    printedWidthHelp: "Hoe breed hij daadwerkelijk wordt op het eindproduct.",
    coloursSummary: "Kleuren en marge",
    modulesLabel: "Modules",
    backgroundLabel: "Achtergrond",
    quietZoneLabel: "Stiltezone",
    quietZoneHelp: "Vier is het standaardminimum.",
  },
  preview: {
    heading: "Voorbeeld",
    moduleSize: "Modulegrootte",
    readableFrom: "Leesbaar vanaf",
    readableUpTo: "tot {distance}cm",
    contrast: "Contrast",
    symbol: "Symbool",
    symbolSpec: "versie {version}, {count}×{count} modules, niveau {level}",
    blockingHeading: "Deze verhinderen het opslaan",
    blockingBody:
      "Al het andere in dit product legt een probleem vast en gaat door. Deze niet, want een gedrukte code heeft geen tweede kans.",
    advisoryHeading: "Goed om te weten",
    saveFailed: "De link kon niet worden opgeslagen.",
    saving: "Opslaan…",
    saveLink: "Deze link opslaan",
    nameFirst: "Geef hem eerst een naam.",
  },
  redirect: {
    heading: "Codes die je later kunt omleiden",
    body: "Een QR-code kan niet verlopen of veranderen — de modules coderen de bestemming. Producten die “dynamische” codes verkopen, verkopen een redirect op hun eigen domein, en kunnen die dus ook stoppen. Zet de redirect op een domein dat je al bezit en dezelfde mogelijkheid kost niets en is aan niemand verantwoording schuldig.",
    platformLabel: "Platform",
    cannotExpire: "kan niet uit zichzelf verlopen",
    shortDomainLabel: "Jouw korte domein",
    endsOnLabel: "Eindigt op",
    expiryNote:
      "{platform} kan geen datum controleren. De einddatum staat erin als commentaar en iets moet het bestand bewerken.",
    building: "Bouwen…",
    buildConfig: "Config bouwen",
    copy: "Kopiëren",
  },
} as const;
