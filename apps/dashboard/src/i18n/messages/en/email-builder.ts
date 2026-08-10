/** The email builder: brand kit, templates, compiler report, and preview. */
export const emailBuilder = {
  report: {
    title: "What clients will do with it",
    okSummary: "Nothing blocking or broken. {size}KB compiled",
    okNoWarnings: ".",
    okWarningSingular: ", with {count} warning worth reading.",
    okWarningPlural: ", with {count} warnings worth reading.",
    blockingRemoved:
      "{count} thing(s) were removed from what you submitted, so the document you have is not the one you wrote. ",
    errorSingular: "{count} error will visibly break in at least one client.",
    errorPlural: "{count} errors will visibly break in at least one client.",
  },
  brandKit: {
    title: "Brand kit",
    revisionMark: "revision {revision}",
    notSetUp: "not set up",
    intro:
      "What an agent writes emails against, and what the compiler checks the result for. The postal address and the unsubscribe tag are not styling: commercial email is legally required to carry both.",
    colours: "Colours",
    colourNameLabel: "Colour {number} name",
    colourValueLabel: "Colour {number} value",
    noStatedUse: "no stated use",
    type: "Type",
    fontStackLabel: "{role} font stack",
    fontStackHelp:
      "End every stack with a generic family. Outlook and Gmail's mobile apps ignore web fonts, and with nothing to fall back to they pick their own default.",
    legalFooter: "Legal footer",
    companyName: "Company name",
    postalAddress: "Postal address",
    unsubscribeLabel: "Unsubscribe merge tag",
    unsubHelpBefore:
      "The unsubscribe tag is whatever your email service substitutes — Mailchimp uses",
    unsubHelpMiddle: ", most others use a",
    unsubHelpAfter:
      "form. Stored verbatim, because guessing it produces a dead link in a legally required place.",
    voice: "Voice",
    voicePlaceholder:
      "How the brand sounds. Read by the agent writing the copy.",
    voiceLabel: "Brand voice",
    changeSummaryPlaceholder: "What changed, and why",
    changeSummaryLabel: "Change summary",
    saveRevision: "Save a revision",
    revisionNote:
      "Every save appends a revision. An email built last quarter can still say which brand it was built against.",
  },
  templates: {
    title: "Templates",
    newNameLabel: "New template name",
    create: "Create",
    empty:
      "No templates yet. Create one, then write the HTML here or ask an attached agent to draft it against your brand kit.",
    noRevisions: "no revisions yet",
    revisionMeta: "revision {revision} · updated {time}",
  },
  compose: {
    title: "Compose",
    starterTitle:
      "A table-based document already built from your brand kit that passes every check.",
    starter: "Start from the brand kit",
    checking: "Checking…",
    check: "Check",
    saveRevision: "Save revision",
    subject: "Subject",
    preheaderPlaceholder:
      "Preheader — the line the inbox shows after the subject",
    preheaderLabel: "Preheader",
    emailHtml: "Email HTML",
    compileFailed: "The email could not be compiled.",
  },
  preview: {
    title: "Preview",
    desktop: "Desktop",
    mobile: "Mobile",
    frameTitle: "Email preview",
    compiledSummary: "Compiled HTML — this is what you export",
    plainTextSummary: "Plain-text alternative",
    exportNote:
      "Marketingovo does not send email. Copy the compiled HTML into your own email service, which already owns your list, your consent records and your unsubscribe handling.",
  },
} as const;
