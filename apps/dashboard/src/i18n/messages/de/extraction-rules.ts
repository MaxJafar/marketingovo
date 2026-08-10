import type { MessagesFor } from "../types";

/** Custom extraction rules card: editor, template library, safe live preview. */
export const extractionRules: MessagesFor<"extractionRules"> = {
  eyebrow: "Evidenz-Konfiguration",
  title: "Eigene Extraktionsregeln",
  description:
    "Erfasse Preise, Autoren, Produkt-IDs, CMS-Marker oder jedes andere Seitenfeld bei jedem Audit. Regeln gehören zu diesem Projekt, und jede gespeicherte Revision bleibt für reproduzierbare Replays verfügbar.",
  currentRuleSet: "Aktuelles Regelset",
  revisionLabel: "Revision {revision}",
  loadingRules: "Extraktionsregeln werden geladen…",
  preparingEditor: "Extraktionseditor wird vorbereitet…",
  rulesUnavailableTitle: "Extraktionsregeln nicht verfügbar",
  revisionSavedTitle: "Regelrevision gespeichert",
  revisionSavedBody:
    "Neue Audits nehmen einen Snapshot dieser Revision. Bestehende Läufe und ihre Evidenz bleiben unverändert.",
  revisionRejectedTitle: "Regelrevision wurde abgelehnt",
  captureOptions: {
    text: "Textinhalt",
    html: "Inneres HTML",
    attribute: "Attribut",
  },
  template: {
    eyebrow: "Bibliothek mit Review-Pflicht",
    title: "Extraktionsvorlagen",
    description:
      "Starte mit einem kuratierten Evidenzpaket, prüfe jeden Selektor und füge es dann dem ungespeicherten Entwurf hinzu. Vorlagen schreiben nie von selbst eine Revision und starten keinen Crawl.",
    policyPill: "Review erforderlich",
    loading: "Extraktionsvorlagen werden geladen…",
    catalogUnavailableTitle: "Vorlagenkatalog nicht verfügbar",
    gridLabel: "Vorlagen",
    review: "{name} prüfen",
    fieldsCount: "{count} Felder",
    addedTitle: "Vorlage zum Entwurf hinzugefügt",
    addedBody:
      "Die Felder von {name} stehen unten zum Prüfen oder für die Vorschau bereit. Nichts wird gespeichert, bis du eine Revisionszusammenfassung angibst und „Revision speichern“ wählst.",
    reviewEyebrow: "Review des Entwurfsimports",
    closeReview: "Review schließen",
    previewOn: "Vorschau auf",
    beforeSaving: "Vor dem Speichern",
    beforeSavingBody:
      "Sieh dir eine repräsentative URL in der Vorschau an und entferne oder benenne Felder um, die nicht zu dieser Site passen.",
    assumptionsLabel: "Zu prüfende Annahmen",
    fieldsTable: "Felder von {name}",
    fieldColumn: "Feld",
    selectorColumn: "CSS-Selektor",
    captureColumn: "Erfassung",
    attributeCapture: "Attribut: {attribute}",
    conflictTitle: "Feldkonflikte auflösen",
    conflictBodyOne:
      "Benenne das bestehende Entwurfsfeld um oder entferne es: {labels}. Vorlagen-Labels müssen eindeutig bleiben.",
    conflictBodyMany:
      "Benenne die bestehenden Entwurfsfelder um oder entferne sie: {labels}. Vorlagen-Labels müssen eindeutig bleiben.",
    capacityTitle: "Regellimit überschritten",
    capacityBody:
      "Dieses Paket würde die Projektgrenze von 50 Regeln überschreiten. Entferne Entwurfsregeln, bevor du es importierst.",
    addFieldsOne: "{count} Feld zum Entwurf hinzufügen",
    addFieldsMany: "{count} Felder zum Entwurf hinzufügen",
    freshIdsNote:
      "Frische Regel-IDs werden lokal erzeugt; Katalog-IDs werden nie gespeichert, als wären sie nutzereigene Konfiguration.",
  },
  editor: {
    listLabel: "Extraktionsregeln",
    empty:
      "Noch keine Regeln. Füge eine hinzu, um seitenspezifische Daten in auditierbare Evidenz zu verwandeln.",
    ruleLegend: "Regel {number}",
    enabled: "Aktiviert",
    removeRule: "Regel {number} entfernen",
    remove: "Entfernen",
    fieldLabel: "Feld-Label",
    capture: "Erfassung",
    cssSelector: "CSS-Selektor",
    attributeName: "Attributname",
    regexLabel: "Sicherer Regex-Filter",
    regexOptional: "(optional)",
    regexHelp:
      "Fanggruppe 1 wird behalten, wenn vorhanden. Rückreferenzen, Lookarounds und mehrdeutige Wiederholung werden abgelehnt.",
    addRule: "Regel hinzufügen",
    revisionSummary: "Revisionszusammenfassung",
    savingRevision: "Revision wird gespeichert…",
    saveRevision: "Revision speichern",
  },
  preview: {
    title: "Sichere Live-Vorschau",
    description:
      "Ruft eine URL auf dem exakten Origin des Projekts ab, über dieselbe redirect-bewusste Egress-Policy wie Audits. Entwurfsregeln werden durch die Vorschau nie gespeichert.",
    failedTitle: "Vorschau fehlgeschlagen",
    pageUrl: "Seiten-URL",
    rendering: "Rendering",
    renderOptions: {
      static: "Statisches HTML",
      js: "JavaScript",
    },
    allowPrivateHost: "Genau diesen privaten Host erlauben",
    allowPrivateHostHelp:
      "Nur für localhost oder eine freigegebene interne Site nötig. Cloud-Metadaten-Adressen bleiben blockiert.",
    renderingPreview: "Vorschau wird gerendert…",
    previewDraft: "Entwurf in der Vorschau prüfen",
    httpStatus: "HTTP {status}",
    responseTime: "{ms} ms",
    finalUrl: "Finale URL",
    resultsTable: "Ergebnisse der Extraktionsvorschau",
    fieldColumn: "Feld",
    resultColumn: "Ergebnis",
    noMatch: "Kein Treffer",
    truncated: "Wert an der Evidenzgrenze gekürzt.",
  },
} as const;
