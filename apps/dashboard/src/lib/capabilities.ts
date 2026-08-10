import { useCapabilities } from "../api/queries";
import type {
  WorkspaceCapabilities,
  WorkspaceCapability,
} from "../api/contracts";

/**
 * What the current workspace can do, unwrapped for page use.
 *
 * `has` is deliberately permissive while the answer is still loading. The cost
 * of being briefly optimistic is a button that enables a moment late; the cost
 * of being briefly pessimistic is telling someone they cannot do something they
 * can, which is the more expensive mistake to make in a control plane.
 */
export function useWorkspaceCapabilities(siteId: string): {
  capabilities: WorkspaceCapabilities | undefined;
  has: (capability: WorkspaceCapability) => boolean;
} {
  const query = useCapabilities(siteId);
  const capabilities = query.data?.data;
  return {
    capabilities,
    has: (capability) =>
      capabilities === undefined
        ? true
        : capabilities.available.includes(capability),
  };
}

/** Requirement sets, named once so surfaces stay comparable. */
export const NEEDS_WEBSITE: WorkspaceCapability[] = ["website"];

/**
 * Keyword work reads positions from a crawl or from Search Console. Either is
 * a real source, so either satisfies the surface.
 */
export const NEEDS_WEBSITE_OR_SEARCH_CONSOLE: WorkspaceCapability[] = [
  "website",
  "search-console",
];
