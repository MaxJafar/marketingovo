import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useIntelClient } from "./client-context.js";

export function useRunEventStream(runId: string | undefined): void {
  const client = useIntelClient();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!runId) return;
    const controller = new AbortController();
    void (async () => {
      try {
        for await (const _event of client.streamRunEvents(runId, {
          signal: controller.signal,
          reconnect: true,
          maxReconnects: 5,
          reconnectDelayMs: 250,
        })) {
          await queryClient.invalidateQueries({ queryKey: ["run", runId] });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          await queryClient.invalidateQueries({ queryKey: ["run", runId] });
        }
      }
    })();
    return () => controller.abort();
  }, [client, queryClient, runId]);
}
