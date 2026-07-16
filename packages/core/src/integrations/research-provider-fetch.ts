import { createSafeProviderFetch } from "@golem-seo/integrations";

/**
 * Exact-host, DNS/address-pinned transport for keyword research providers.
 * The keyless Google HTML fallback is included explicitly; no wildcard or
 * suffix matching is used.
 */
export const safeResearchProviderFetch = createSafeProviderFetch({
  allowedHosts: ["serpapi.com", "api.dataforseo.com", "www.google.com"],
});
