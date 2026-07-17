import { createContext, useContext, useMemo, type PropsWithChildren } from "react";
import { GolemIntelClient } from "@golem-intel/sdk";

const ClientContext = createContext<GolemIntelClient | null>(null);

export const dashboardFetch = window.fetch.bind(window);

interface IntelClientProviderProps extends PropsWithChildren {
  csrfToken: string;
}

export function IntelClientProvider({
  csrfToken,
  children,
}: IntelClientProviderProps): React.JSX.Element {
  const client = useMemo(
    () =>
      new GolemIntelClient({
        baseUrl: import.meta.env.VITE_GOLEM_INTEL_API_URL ?? "",
        csrfToken,
        credentials: "same-origin",
        fetch: dashboardFetch,
      }),
    [csrfToken],
  );
  return (
    <ClientContext.Provider value={client}>{children}</ClientContext.Provider>
  );
}

export function useIntelClient(): GolemIntelClient {
  const client = useContext(ClientContext);
  if (!client) throw new Error("IntelClientProvider is missing");
  return client;
}
