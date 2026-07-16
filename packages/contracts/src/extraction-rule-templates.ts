import type { ExtractionRuleTemplateCatalog } from "./index.js";

/**
 * Curated, provider-free rule packs. Template rule ids are catalog-local;
 * clients must materialize fresh ids only after an explicit review step.
 */
export const BUILT_IN_EXTRACTION_RULE_TEMPLATE_CATALOG = {
  version: "extraction-template-catalog-v1",
  importMode: "review_required",
  templates: [
    {
      id: "social-preview-meta",
      name: "Social preview metadata",
      category: "social",
      description:
        "Capture the Open Graph and X/Twitter fields that shape shared-link previews.",
      recommendedPage:
        "A representative homepage, landing page, article, or product page.",
      assumptions: [
        "The page emits standard meta tags in the rendered document head.",
        "Each rule captures the first matching element; preview representative templates before saving.",
        "A missing value is evidence of no selector match, not proof that a platform will reject the page.",
      ],
      rules: [
        {
          id: "social-og-title",
          label: "Open Graph title",
          selector: "meta[property='og:title']",
          type: "attribute",
          attribute: "content",
          regex: null,
          enabled: true,
        },
        {
          id: "social-og-description",
          label: "Open Graph description",
          selector: "meta[property='og:description']",
          type: "attribute",
          attribute: "content",
          regex: null,
          enabled: true,
        },
        {
          id: "social-og-image",
          label: "Open Graph image",
          selector: "meta[property='og:image']",
          type: "attribute",
          attribute: "content",
          regex: null,
          enabled: true,
        },
        {
          id: "social-twitter-card",
          label: "Twitter card type",
          selector: "meta[name='twitter:card']",
          type: "attribute",
          attribute: "content",
          regex: null,
          enabled: true,
        },
      ],
    },
    {
      id: "editorial-article-meta",
      name: "Editorial article metadata",
      category: "editorial",
      description:
        "Capture authorship, publication timing, and section metadata for editorial QA.",
      recommendedPage: "A published article from each editorial template.",
      assumptions: [
        "The site uses common author and article Open Graph meta properties.",
        "Dates remain raw source values so reviewers can detect timezone or formatting inconsistencies.",
        "These fields support QA; they do not establish authorship quality or ranking impact by themselves.",
      ],
      rules: [
        {
          id: "editorial-author",
          label: "Article author",
          selector: "meta[name='author']",
          type: "attribute",
          attribute: "content",
          regex: null,
          enabled: true,
        },
        {
          id: "editorial-published-time",
          label: "Article published time",
          selector: "meta[property='article:published_time']",
          type: "attribute",
          attribute: "content",
          regex: null,
          enabled: true,
        },
        {
          id: "editorial-modified-time",
          label: "Article modified time",
          selector: "meta[property='article:modified_time']",
          type: "attribute",
          attribute: "content",
          regex: null,
          enabled: true,
        },
        {
          id: "editorial-section",
          label: "Article section",
          selector: "meta[property='article:section']",
          type: "attribute",
          attribute: "content",
          regex: null,
          enabled: true,
        },
      ],
    },
    {
      id: "commerce-product-meta",
      name: "Commerce product metadata",
      category: "commerce",
      description:
        "Capture common product price metadata, SKU evidence, and the first structured-data payload.",
      recommendedPage:
        "A purchasable product detail page from each storefront template.",
      assumptions: [
        "Commerce Open Graph properties and schema.org item properties vary by platform; no match is expected on some stacks.",
        "The JSON-LD rule captures only the first matching block and must be reviewed before treating it as Product data.",
        "Price values remain raw so locale, currency, and formatting defects stay visible.",
      ],
      rules: [
        {
          id: "commerce-price-amount",
          label: "Product price amount",
          selector: "meta[property='product:price:amount']",
          type: "attribute",
          attribute: "content",
          regex: null,
          enabled: true,
        },
        {
          id: "commerce-price-currency",
          label: "Product price currency",
          selector: "meta[property='product:price:currency']",
          type: "attribute",
          attribute: "content",
          regex: null,
          enabled: true,
        },
        {
          id: "commerce-sku",
          label: "Product SKU",
          selector: "meta[itemprop='sku']",
          type: "attribute",
          attribute: "content",
          regex: null,
          enabled: true,
        },
        {
          id: "commerce-jsonld",
          label: "First JSON-LD payload",
          selector: "script[type='application/ld+json']",
          type: "text",
          attribute: null,
          regex: null,
          enabled: true,
        },
      ],
    },
    {
      id: "migration-template-markers",
      name: "Migration template markers",
      category: "migration",
      description:
        "Capture CMS and DOM markers used to verify template coverage during a redesign or migration.",
      recommendedPage:
        "One representative URL from every old and new page template.",
      assumptions: [
        "Body classes and data attributes are implementation evidence, not durable public contracts.",
        "Rename or remove selectors that do not match the site's actual migration markers.",
        "Run the pack on an exact URL cohort and compare raw values before and after deployment.",
      ],
      rules: [
        {
          id: "migration-generator",
          label: "CMS generator",
          selector: "meta[name='generator']",
          type: "attribute",
          attribute: "content",
          regex: null,
          enabled: true,
        },
        {
          id: "migration-body-class",
          label: "Body template classes",
          selector: "body[class]",
          type: "attribute",
          attribute: "class",
          regex: null,
          enabled: true,
        },
        {
          id: "migration-template-name",
          label: "Template marker",
          selector: "[data-template]",
          type: "attribute",
          attribute: "data-template",
          regex: null,
          enabled: true,
        },
        {
          id: "migration-page-type",
          label: "Page type marker",
          selector: "[data-page-type]",
          type: "attribute",
          attribute: "data-page-type",
          regex: null,
          enabled: true,
        },
      ],
    },
  ],
} as const satisfies ExtractionRuleTemplateCatalog;
