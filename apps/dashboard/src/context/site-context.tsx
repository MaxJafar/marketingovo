import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ApiError } from "../api/client";
import type { Site } from "../api/contracts";
import { useSites } from "../api/queries";

const STORAGE_KEY = "agentseo:selected-site:v1";

interface SiteContextValue {
  sites: Site[];
  siteId: string;
  site?: Site;
  setSiteId: (siteId: string) => void;
  isLoading: boolean;
  error: ApiError | Error | null;
  refetch: () => void;
}

const SiteContext = createContext<SiteContextValue | null>(null);

function readStoredSite(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const sitesQuery = useSites();
  const [selectedId, setSelectedId] = useState(readStoredSite);
  const sites = sitesQuery.data?.data.items ?? [];
  const selectedSite = sites.find((site) => site.id === selectedId) ?? sites[0];
  const siteId = selectedSite?.id ?? "";

  const value = useMemo<SiteContextValue>(
    () => ({
      sites,
      siteId,
      site: selectedSite,
      setSiteId: (nextId) => {
        setSelectedId(nextId);
        try {
          window.localStorage.setItem(STORAGE_KEY, nextId);
        } catch {
          // Storage can be unavailable in locked-down browser contexts; in-memory selection still works.
        }
      },
      isLoading: sitesQuery.isLoading,
      error: sitesQuery.error as ApiError | Error | null,
      refetch: () => void sitesQuery.refetch(),
    }),
    [
      siteId,
      selectedSite,
      sites,
      sitesQuery.error,
      sitesQuery.isLoading,
      sitesQuery.refetch,
    ],
  );

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  const value = useContext(SiteContext);
  if (!value) throw new Error("useSite must be used inside SiteProvider");
  return value;
}
