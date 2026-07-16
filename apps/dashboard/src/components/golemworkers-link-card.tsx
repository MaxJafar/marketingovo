import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, type ApiResult } from "../api/client";
import { Button, Card, InlineNotice, StatusBadge, formatDate } from "./ui";
import { Icon } from "./icon";

interface LinkStatus {
  state: "disconnected" | "pending" | "connected" | "failed";
  verificationUrl: string | null;
  userCode: string | null;
  expiresAt: string | null;
  orgId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

interface ImportSummary {
  import: {
    projectId: string;
    runCount: number;
    actionCount: number;
    issueCount: number;
  };
}

const queryKey = ["golemworkers-device-link"] as const;

function safeVerificationUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function GolemWorkersLinkCard({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      apiRequest<LinkStatus>("/golemworkers/device/status", { signal }),
    refetchInterval: (query) =>
      query.state.data?.data.state === "pending" ? 2_000 : false,
  });
  const start = useMutation({
    mutationFn: () =>
      apiRequest<LinkStatus>("/golemworkers/device/start", { method: "POST" }),
    onSuccess: (result) =>
      queryClient.setQueryData<ApiResult<LinkStatus>>(queryKey, result),
  });
  const disconnect = useMutation({
    mutationFn: () =>
      apiRequest<void>("/golemworkers/device", { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const importProject = useMutation({
    mutationFn: () =>
      apiRequest<ImportSummary>("/golemworkers/import", {
        method: "POST",
        body: JSON.stringify({ projectId }),
      }),
  });
  const status = statusQuery.data?.data;
  const verificationUrl = safeVerificationUrl(status?.verificationUrl ?? null);
  const busy =
    start.isPending || disconnect.isPending || importProject.isPending;

  return (
    <Card className="hosted-link-card">
      <div className="hosted-link-heading">
        <div>
          <p className="eyebrow">Optional hosted workspace</p>
          <h2>GolemWorkers Full</h2>
          <p>
            Unlock always-on monitoring, teams, managed integrations and AI
            execution. Your local project stays usable either way.
          </p>
        </div>
        <StatusBadge
          status={status?.state ?? (statusQuery.isError ? "failed" : "unknown")}
        />
      </div>

      {statusQuery.isError ? (
        <InlineNotice tone="danger" title="Hosted link status is unavailable">
          {statusQuery.error.message}
        </InlineNotice>
      ) : null}
      {status?.state === "failed" ? (
        <InlineNotice tone="danger" title="Device linking failed">
          {status.errorMessage ?? "Start a new device link and try again."}
        </InlineNotice>
      ) : null}
      {start.isError ? (
        <InlineNotice tone="danger" title="Could not start device linking">
          {start.error.message}
        </InlineNotice>
      ) : null}
      {disconnect.isError ? (
        <InlineNotice tone="danger" title="Could not disconnect">
          {disconnect.error.message}
        </InlineNotice>
      ) : null}
      {importProject.isError ? (
        <InlineNotice tone="danger" title="Project import failed">
          {importProject.error.message}
        </InlineNotice>
      ) : null}

      {status?.state === "pending" ? (
        <div className="hosted-link-code" aria-live="polite">
          <div>
            <span>One-time code</span>
            <strong>{status.userCode ?? "Unavailable"}</strong>
          </div>
          <p>
            Open GolemWorkers, sign in, and approve this device. This page will
            update automatically. The code expires{" "}
            {formatDate(status.expiresAt, true)}.
          </p>
          {verificationUrl ? (
            <a
              className="button button-primary"
              href={verificationUrl}
              target="_blank"
              rel="noreferrer"
            >
              Approve device <Icon name="external" />
            </a>
          ) : null}
        </div>
      ) : null}

      {status?.state === "connected" ? (
        <div className="hosted-link-connected" aria-live="polite">
          <div>
            <strong>Connected securely</strong>
            <span>
              Organization {status.orgId ?? "linked"} · token expires{" "}
              {formatDate(status.expiresAt, true)}
            </span>
          </div>
          <p>
            Exports never contain provider credentials. Integrations must be
            reconnected in the hosted workspace.
          </p>
        </div>
      ) : null}

      {importProject.isSuccess ? (
        <InlineNotice tone="success" title="Project imported">
          Hosted project {importProject.data.data.import.projectId} now includes{" "}
          {importProject.data.data.import.runCount} runs,{" "}
          {importProject.data.data.import.actionCount} actions, and{" "}
          {importProject.data.data.import.issueCount} issues.
        </InlineNotice>
      ) : null}

      <div className="integration-actions">
        {status?.state === "connected" ? (
          <>
            <Button
              onClick={() => importProject.mutate()}
              disabled={!projectId || busy}
            >
              {importProject.isPending
                ? "Importing securely…"
                : "Import this site"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => start.mutate()}
              disabled={busy}
            >
              Reconnect
            </Button>
            <Button
              variant="ghost"
              onClick={() => disconnect.mutate()}
              disabled={busy}
            >
              Disconnect locally
            </Button>
          </>
        ) : status?.state !== "pending" ? (
          <Button onClick={() => start.mutate()} disabled={busy}>
            {start.isPending ? "Starting…" : "Connect GolemWorkers"}
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={() => start.mutate()}
            disabled={busy}
          >
            Start over
          </Button>
        )}
      </div>
    </Card>
  );
}
