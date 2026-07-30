import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { apiDownload, apiRequest, withQuery, type ApiResult } from "./client";
import type {
  AuditRun,
  AuditRunDetail,
  ActionCheckpoint,
  ActionEvidenceResponse,
  ActionStatus,
  ActionVerificationRun,
  Competitor,
  CreateSiteInput,
  DashboardSettings,
  ExtractionPreview,
  ExtractionRule,
  ExtractionRuleTemplateCatalog,
  ExtractionRuleWorkspace,
  Integration,
  IssueReviewPage,
  IssueStatus,
  KeywordWorkspace,
  ListResponse,
  MonitoringWorkspace,
  Overview,
  PageRecord,
  ProjectContextJournalEntry,
  ProjectContextProfile,
  ProjectContextWorkspace,
  ProjectDeletionReceipt,
  ProjectImportResult,
  Report,
  RunEvidencePage,
  RunEvidenceSection,
  RunLinkExplorer,
  InternalLinkDirection,
  RunComparison,
  RunReplay,
  SeoAction,
  Site,
  StartAuditInput,
  SystemHealth,
} from "./contracts";

export const queryKeys = {
  sites: ["sites"] as const,
  overview: (siteId: string) => ["overview", siteId] as const,
  context: (siteId: string) => ["context", siteId] as const,
  actions: (siteId: string) => ["actions", siteId] as const,
  issues: (siteId: string, filters: IssueReviewFilters) =>
    ["issues", siteId, filters] as const,
  actionEvidence: (actionId: string) => ["action-evidence", actionId] as const,
  runs: (siteId: string) => ["runs", siteId] as const,
  run: (runId: string) => ["run", runId] as const,
  runComparison: (currentRunId: string, baselineRunId: string) =>
    ["run-comparison", currentRunId, baselineRunId] as const,
  runEvidence: (
    runId: string,
    section: RunEvidenceSection,
    offset: number,
    search: string,
  ) => ["run-evidence", runId, section, offset, search] as const,
  runLinks: (
    runId: string,
    pageUrl: string,
    direction: InternalLinkDirection,
    offset: number,
    search: string,
  ) => ["run-links", runId, pageUrl, direction, offset, search] as const,
  pages: (siteId: string) => ["pages", siteId] as const,
  keywords: (siteId: string) => ["keywords", siteId] as const,
  competitors: (siteId: string) => ["competitors", siteId] as const,
  monitoring: (siteId: string) => ["monitoring", siteId] as const,
  reports: (siteId: string) => ["reports", siteId] as const,
  integrations: (siteId: string) => ["integrations", siteId] as const,
  settings: (siteId: string) => ["settings", siteId] as const,
  extractionRules: (siteId: string) => ["extraction-rules", siteId] as const,
  extractionRuleTemplates: ["extraction-rule-templates"] as const,
  systemHealth: ["system-health"] as const,
};

export function useSites() {
  return useQuery({
    queryKey: queryKeys.sites,
    queryFn: ({ signal }) =>
      apiRequest<ListResponse<Site>>("/sites", { signal }),
    staleTime: 60_000,
  });
}

function useSiteQuery<T>(
  key: readonly unknown[],
  path: string,
  siteId: string,
) {
  return useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      apiRequest<T>(withQuery(path, { siteId }), { signal }),
    enabled: Boolean(siteId),
  });
}

export const useOverview = (siteId: string) =>
  useSiteQuery<Overview>(queryKeys.overview(siteId), "/overview", siteId);

export const useProjectContext = (siteId: string) =>
  useQuery({
    queryKey: queryKeys.context(siteId),
    queryFn: ({ signal }) =>
      apiRequest<ProjectContextWorkspace>(
        `/projects/${encodeURIComponent(siteId)}/context`,
        { signal },
      ),
    enabled: Boolean(siteId),
  });

export function useUpdateProjectContext(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      profile: ProjectContextProfile;
      changeSummary: string;
    }) =>
      apiRequest<ProjectContextWorkspace>(
        `/projects/${encodeURIComponent(siteId)}/context`,
        { method: "PUT", body: JSON.stringify(input) },
      ),
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.context(siteId) }),
  });
}

export function useAppendProjectContextJournal(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      kind: ProjectContextJournalEntry["kind"];
      title: string;
      detail: string;
      sourceRunId?: string | null;
    }) =>
      apiRequest<ProjectContextJournalEntry>(
        `/projects/${encodeURIComponent(siteId)}/context/journal`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.context(siteId) }),
  });
}

export const useActions = (siteId: string) =>
  useSiteQuery<ListResponse<SeoAction>>(
    queryKeys.actions(siteId),
    "/actions",
    siteId,
  );

export interface IssueReviewFilters {
  limit: number;
  offset: number;
  status?: IssueStatus;
  severity?: "critical" | "high" | "medium" | "low" | "info";
  search?: string;
}

export function useIssues(siteId: string, filters: IssueReviewFilters) {
  return useQuery({
    queryKey: queryKeys.issues(siteId, filters),
    queryFn: ({ signal }) =>
      apiRequest<IssueReviewPage>(
        withQuery("/issues", {
          projectId: siteId,
          limit: String(filters.limit),
          offset: String(filters.offset),
          status: filters.status,
          severity: filters.severity,
          search: filters.search,
        }),
        { signal },
      ),
    enabled: Boolean(siteId),
  });
}

export function useUpdateIssueAdjudication(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      fingerprint: string;
      status: "open" | "ignored" | "false_positive";
      note?: string | null;
    }) =>
      apiRequest(`/issues/${encodeURIComponent(input.fingerprint)}`, {
        method: "PATCH",
        body: JSON.stringify({
          projectId: siteId,
          status: input.status,
          note: input.status === "open" ? null : input.note,
        }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["issues", siteId] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.actions(siteId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.overview(siteId) }),
      ]);
    },
  });
}

export function useActionEvidence(actionId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.actionEvidence(actionId),
    queryFn: ({ pageParam, signal }) =>
      apiRequest<ActionEvidenceResponse>(
        withQuery(`/actions/${encodeURIComponent(actionId)}/evidence`, {
          limit: "100",
          cursor: pageParam ?? undefined,
        }),
        { signal },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.data.pageInfo.nextCursor,
    enabled: Boolean(actionId),
    refetchInterval: (query) => {
      const state = query.state.data?.pages[0]?.data.verification.state;
      return state === "queued" || state === "running" ? 1_000 : false;
    },
  });
}

export function useRuns(siteId: string) {
  return useQuery({
    queryKey: queryKeys.runs(siteId),
    queryFn: ({ signal }) =>
      apiRequest<ListResponse<AuditRun>>(withQuery("/runs", { siteId }), {
        signal,
      }),
    enabled: Boolean(siteId),
    refetchInterval: (query) => {
      const runs = query.state.data?.data.items ?? [];
      return runs.some(
        (run) => run.status === "queued" || run.status === "running",
      )
        ? 750
        : false;
    },
  });
}

export function useRun(runId: string) {
  return useQuery({
    queryKey: queryKeys.run(runId),
    queryFn: ({ signal }) =>
      apiRequest<AuditRunDetail>(`/runs/${encodeURIComponent(runId)}`, {
        signal,
      }),
    enabled: Boolean(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.data.status;
      return status === "queued" || status === "running" ? 750 : false;
    },
  });
}

export function useReplayRun(runId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<RunReplay>(`/runs/${encodeURIComponent(runId)}/replay`, {
        method: "POST",
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["runs"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.run(runId) }),
      ]);
    },
  });
}

export function useRunComparison(currentRunId: string, baselineRunId: string) {
  return useQuery({
    queryKey: queryKeys.runComparison(currentRunId, baselineRunId),
    queryFn: ({ signal }) =>
      apiRequest<RunComparison>(
        withQuery(`/runs/${encodeURIComponent(currentRunId)}/comparison`, {
          baselineRunId,
        }),
        { signal },
      ),
    enabled:
      Boolean(currentRunId) &&
      Boolean(baselineRunId) &&
      currentRunId !== baselineRunId,
  });
}

export function useRunEvidence(
  runId: string,
  options: {
    section: RunEvidenceSection;
    offset?: number;
    limit?: number;
    search?: string;
    enabled?: boolean;
  },
) {
  const offset = options.offset ?? 0;
  const search = options.search?.trim() ?? "";
  return useQuery({
    queryKey: queryKeys.runEvidence(runId, options.section, offset, search),
    queryFn: ({ signal }) =>
      apiRequest<RunEvidencePage>(
        withQuery(`/runs/${encodeURIComponent(runId)}/evidence`, {
          section: options.section,
          limit: String(options.limit ?? 50),
          offset: String(offset),
          search: search || undefined,
        }),
        { signal },
      ),
    enabled: Boolean(runId) && (options.enabled ?? true),
  });
}

export function useRunLinks(
  runId: string,
  pageUrl: string,
  options: {
    direction: InternalLinkDirection;
    offset?: number;
    limit?: number;
    search?: string;
    enabled?: boolean;
  },
) {
  const offset = options.offset ?? 0;
  const search = options.search?.trim() ?? "";
  return useQuery({
    queryKey: queryKeys.runLinks(
      runId,
      pageUrl,
      options.direction,
      offset,
      search,
    ),
    queryFn: ({ signal }) =>
      apiRequest<RunLinkExplorer>(
        withQuery(`/runs/${encodeURIComponent(runId)}/links`, {
          pageUrl,
          direction: options.direction,
          limit: String(options.limit ?? 50),
          offset: String(offset),
          search: search || undefined,
        }),
        { signal },
      ),
    enabled: Boolean(runId) && Boolean(pageUrl) && (options.enabled ?? true),
  });
}

export const usePages = (siteId: string) =>
  useSiteQuery<ListResponse<PageRecord>>(
    queryKeys.pages(siteId),
    "/pages",
    siteId,
  );

export const useKeywords = (siteId: string) =>
  useSiteQuery<KeywordWorkspace>(
    queryKeys.keywords(siteId),
    "/keywords",
    siteId,
  );

export const useCompetitors = (siteId: string) =>
  useSiteQuery<ListResponse<Competitor>>(
    queryKeys.competitors(siteId),
    "/competitors",
    siteId,
  );

export const useMonitoring = (siteId: string) =>
  useSiteQuery<MonitoringWorkspace>(
    queryKeys.monitoring(siteId),
    "/monitoring",
    siteId,
  );

export const useReports = (siteId: string) =>
  useSiteQuery<ListResponse<Report>>(
    queryKeys.reports(siteId),
    "/reports",
    siteId,
  );

export const useIntegrations = (siteId: string) =>
  useSiteQuery<ListResponse<Integration>>(
    queryKeys.integrations(siteId),
    "/integrations",
    siteId,
  );

export const useSettings = (siteId: string) =>
  useSiteQuery<DashboardSettings>(
    queryKeys.settings(siteId),
    "/settings",
    siteId,
  );

export const useExtractionRules = (siteId: string) =>
  useQuery({
    queryKey: queryKeys.extractionRules(siteId),
    queryFn: ({ signal }) =>
      apiRequest<ExtractionRuleWorkspace>(
        `/projects/${encodeURIComponent(siteId)}/extraction-rules`,
        { signal },
      ),
    enabled: Boolean(siteId),
  });

export const useExtractionRuleTemplates = () =>
  useQuery({
    queryKey: queryKeys.extractionRuleTemplates,
    queryFn: ({ signal }) =>
      apiRequest<ExtractionRuleTemplateCatalog>("/extraction-rule-templates", {
        signal,
      }),
    staleTime: Number.POSITIVE_INFINITY,
  });

export function useUpdateExtractionRules(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { rules: ExtractionRule[]; changeSummary: string }) =>
      apiRequest<ExtractionRuleWorkspace>(
        `/projects/${encodeURIComponent(siteId)}/extraction-rules`,
        { method: "PUT", body: JSON.stringify(input) },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.extractionRules(siteId),
      }),
  });
}

export function usePreviewExtractionRules(siteId: string) {
  return useMutation({
    mutationFn: (input: {
      url: string;
      renderMode: "static" | "js";
      allowPrivateHost: boolean;
      rules: ExtractionRule[];
    }) =>
      apiRequest<ExtractionPreview>(
        `/projects/${encodeURIComponent(siteId)}/extraction-rules/preview`,
        { method: "POST", body: JSON.stringify(input) },
      ),
  });
}

export function useSystemHealth() {
  return useQuery({
    queryKey: queryKeys.systemHealth,
    queryFn: ({ signal }) =>
      apiRequest<SystemHealth>("/system/health", { signal }),
    refetchInterval: 30_000,
  });
}

export function useCreateSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSiteInput) =>
      apiRequest<Site>("/sites", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.sites }),
  });
}

export function useStartAudit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StartAuditInput) => {
      const options = {
        ...(input.mode ? { mode: input.mode } : {}),
        ...(input.privateHostAllowlist
          ? { privateHostAllowlist: input.privateHostAllowlist }
          : {}),
        ...(input.exactUrls ? { exactUrls: input.exactUrls } : {}),
      };
      return apiRequest<AuditRun>("/runs", {
        method: "POST",
        body: JSON.stringify({
          projectId: input.siteId,
          workflowId: "audit",
          ...(input.goal ? { goal: input.goal } : {}),
          ...(Object.keys(options).length > 0 ? { options } : {}),
        }),
      });
    },
    onSuccess: (_, input) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.runs(input.siteId) }),
  });
}

export interface StartWorkflowInput {
  projectId: string;
  workflowId: "compare" | "keyword-research" | "content-plan";
  options: Record<string, unknown>;
}

export function useStartWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StartWorkflowInput) =>
      apiRequest<AuditRun>("/runs", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: async (_, input) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.runs(input.projectId),
        }),
        queryClient.invalidateQueries({
          queryKey:
            input.workflowId === "compare"
              ? queryKeys.competitors(input.projectId)
              : queryKeys.keywords(input.projectId),
        }),
      ]);
    },
  });
}

export function useTestIntegration(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (integrationId: string) =>
      apiRequest<Integration>(
        `/integrations/${encodeURIComponent(integrationId)}/test`,
        {
          method: "POST",
          body: JSON.stringify({ siteId }),
        },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations(siteId),
      }),
  });
}

export function useSaveIntegrationCredentials(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      integrationId,
      credentials,
    }: {
      integrationId: string;
      credentials: Record<string, string>;
    }) =>
      apiRequest<Integration>(
        `/integrations/${encodeURIComponent(integrationId)}/credentials`,
        {
          method: "POST",
          body: JSON.stringify({ siteId, credentials }),
        },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations(siteId),
      }),
  });
}

export function useSaveIntegrationConfiguration(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      integrationId,
      configuration,
    }: {
      integrationId: string;
      configuration: Record<string, unknown>;
    }) =>
      apiRequest<Integration>(
        `/integrations/${encodeURIComponent(integrationId)}/configuration`,
        {
          method: "PATCH",
          body: JSON.stringify({ siteId, configuration }),
        },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations(siteId),
      }),
  });
}

export function useRemoveIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (integrationId: string) =>
      apiRequest<void>(`/integrations/${encodeURIComponent(integrationId)}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["integrations"] }),
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
      ]);
    },
  });
}

export function useUpdateAction(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      actionId,
      status,
    }: {
      actionId: string;
      status: ActionStatus;
    }) =>
      apiRequest(`/actions/${encodeURIComponent(actionId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: async (_, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.actions(siteId) }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.overview(siteId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.actionEvidence(input.actionId),
        }),
      ]);
    },
  });
}

export function useCreateActionCheckpoint(actionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<ActionCheckpoint>(
        `/actions/${encodeURIComponent(actionId)}/checkpoints`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.actionEvidence(actionId),
      }),
  });
}

export function useVerifyAction(actionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (checkpointId: string) =>
      apiRequest<ActionVerificationRun>(
        `/actions/${encodeURIComponent(actionId)}/verify`,
        {
          method: "POST",
          body: JSON.stringify({ checkpointId }),
        },
      ),
    onSuccess: async (result) => {
      queryClient.setQueryData<
        InfiniteData<ApiResult<ActionEvidenceResponse>, string | null>
      >(queryKeys.actionEvidence(actionId), (current) =>
        current
          ? {
              ...current,
              pages: current.pages.map((page) => ({
                ...page,
                data: {
                  ...page.data,
                  verification: {
                    ...page.data.verification,
                    state: "queued",
                    runId: result.data.runId,
                    reason: "A targeted verification run is queued.",
                  },
                },
              })),
            }
          : current,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["actions"] }),
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
      ]);
    },
  });
}

export interface ScheduleDefinitionInput {
  cron: string;
  timezone: string;
  enabled: boolean;
}

export function useCreateSchedule(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ScheduleDefinitionInput) =>
      apiRequest("/schedules", {
        method: "POST",
        body: JSON.stringify({ projectId: siteId, ...input }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.monitoring(siteId) }),
  });
}

export function useUpdateSchedule(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scheduleId,
      input,
    }: {
      scheduleId: string;
      input: Partial<ScheduleDefinitionInput>;
    }) =>
      apiRequest(`/schedules/${encodeURIComponent(scheduleId)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.monitoring(siteId) }),
  });
}

export function useDeleteSchedule(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scheduleId: string) =>
      apiRequest(`/schedules/${encodeURIComponent(scheduleId)}`, {
        method: "DELETE",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.monitoring(siteId) }),
  });
}

export function useUpdateSettings(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<DashboardSettings>) =>
      apiRequest<DashboardSettings>(withQuery("/settings", { siteId }), {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.settings(siteId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sites }),
        queryClient.invalidateQueries({ queryKey: queryKeys.overview(siteId) }),
      ]);
    },
  });
}

export function useExportProject(siteId: string) {
  return useMutation({
    mutationFn: () =>
      apiDownload("/export", {
        method: "POST",
        body: JSON.stringify({ projectId: siteId }),
      }),
  });
}

export function useImportProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 25 * 1024 * 1024) {
        throw new Error("The .agentseo file must be 25 MiB or smaller.");
      }
      const lowerName = file.name.toLowerCase();
      if (
        !lowerName.endsWith(".agentseo") &&
        // Accepted for bundles exported under the previous product name.
        !lowerName.endsWith(".golemseo")
      ) {
        throw new Error(
          "Choose a file with the .agentseo or .golemseo extension.",
        );
      }
      return apiRequest<ProjectImportResult>("/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/vnd.agentseo.project+json",
        },
        body: await file.text(),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sites });
    },
  });
}

export function useDeleteProject(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (confirmation: string) =>
      apiRequest<ProjectDeletionReceipt>(
        `/projects/${encodeURIComponent(siteId)}`,
        {
          method: "DELETE",
          body: JSON.stringify({ confirmation }),
        },
      ),
    onSuccess: async () => {
      queryClient.removeQueries({
        predicate: (query) => query.queryKey.some((part) => part === siteId),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.sites });
    },
  });
}
