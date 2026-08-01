import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";
import { AgentIntelClient } from "@agentintel/sdk";

const ClientContext = createContext<AgentIntelClient | null>(null);

export const dashboardFetch = window.fetch.bind(window);

interface IntelClientProviderProps extends PropsWithChildren {
  csrfToken?: string;
  /**
   * Supplying a client replaces the one this provider would build. Only tests
   * do that; the application always passes a csrfToken and lets the provider
   * own construction, so the loopback credential boundary stays in one place.
   */
  client?: AgentIntelClient;
}

export function IntelClientProvider({
  csrfToken,
  client: injected,
  children,
}: IntelClientProviderProps): React.JSX.Element {
  const client = useMemo(
    () =>
      injected ??
      new AgentIntelClient({
        baseUrl: import.meta.env.VITE_AGENTINTEL_API_URL ?? "",
        csrfToken: csrfToken ?? "",
        credentials: "same-origin",
        fetch: dashboardFetch,
      }),
    [csrfToken, injected],
  );
  return (
    <ClientContext.Provider value={client}>{children}</ClientContext.Provider>
  );
}

export function useIntelClient(): AgentIntelClient {
  const client = useContext(ClientContext);
  if (!client) throw new Error("IntelClientProvider is missing");
  return client;
}
