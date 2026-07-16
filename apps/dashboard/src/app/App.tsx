import { useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  bootstrapDashboardSession,
  GolemIntelApiError,
  GolemIntelClient,
  type DashboardSession,
} from "@golem-intel/sdk";
import { queryClient } from "./query-client.js";
import { AppRouter } from "./router.js";
import { IntelClientProvider } from "../api/client-context.js";
import { SessionHandshake } from "../components/SessionHandshake.js";
import { TokenGate } from "../components/TokenGate.js";

function apiBaseUrl(): string {
  return import.meta.env.VITE_GOLEM_INTEL_API_URL ?? "";
}

export function consumeBootstrapToken(): string {
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const token = fragment.get("token")?.trim() ?? "";
  if (token) window.history.replaceState(null, "", window.location.pathname);
  return token;
}

const initialBootstrapTicket = consumeBootstrapToken();

let activeExchange:
  { ticket: string; promise: Promise<DashboardSession> } | undefined;
let initialRestore: Promise<DashboardSession> | undefined;

function exchangeTicket(ticket: string): Promise<DashboardSession> {
  if (activeExchange?.ticket === ticket) return activeExchange.promise;
  const promise = bootstrapDashboardSession(ticket, { baseUrl: apiBaseUrl() });
  activeExchange = { ticket, promise };
  const clear = (): void => {
    if (activeExchange?.promise === promise) activeExchange = undefined;
  };
  void promise.then(clear, clear);
  return promise;
}

function restoreSession(): Promise<DashboardSession> {
  initialRestore ??= new GolemIntelClient({
    baseUrl: apiBaseUrl(),
    credentials: "same-origin",
  }).session.get();
  return initialRestore;
}

export function App(): React.JSX.Element {
  const [ticket, setTicket] = useState(initialBootstrapTicket);
  const [session, setSession] = useState<DashboardSession>();
  const [restoring, setRestoring] = useState(!initialBootstrapTicket);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const consumeHash = (): void => {
      const nextToken = consumeBootstrapToken();
      if (nextToken) {
        setSession(undefined);
        setError(undefined);
        setTicket(nextToken);
      }
    };
    window.addEventListener("hashchange", consumeHash);
    return () => window.removeEventListener("hashchange", consumeHash);
  }, []);

  useEffect(() => {
    if (initialBootstrapTicket) return;
    let active = true;
    void restoreSession()
      .then((restored) => {
        if (active) setSession(restored);
      })
      .catch((reason: unknown) => {
        if (
          !active ||
          (reason instanceof GolemIntelApiError && reason.status === 401)
        ) {
          return;
        }
        setError(
          reason instanceof Error
            ? reason.message
            : "Session restoration failed",
        );
      })
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ticket) return;
    let active = true;
    setError(undefined);
    void exchangeTicket(ticket)
      .then((nextSession) => {
        if (active) setSession(nextSession);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Session exchange failed",
          );
        }
      })
      .finally(() => {
        if (active) setTicket("");
      });
    return () => {
      active = false;
    };
  }, [ticket]);

  if (session) {
    return (
      <IntelClientProvider csrfToken={session.csrf}>
        <QueryClientProvider client={queryClient}>
          <AppRouter />
        </QueryClientProvider>
      </IntelClientProvider>
    );
  }
  if (ticket || restoring)
    return <SessionHandshake restoring={restoring && !ticket} />;
  return (
    <TokenGate
      error={error}
      onUnlock={(nextTicket) => {
        setError(undefined);
        setTicket(nextTicket);
      }}
    />
  );
}
