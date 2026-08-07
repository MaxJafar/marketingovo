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
  BrandKitProfile,
  BrandKitWorkspace,
  CalendarEntry,
  CampaignLink,
  CampaignLinkPreview,
  ChannelAccount,
  EmailPreview,
  EmailTemplate,
  EmailTemplateWorkspace,
  MarketingReport,
  MarketingReportSummary,
  ChannelPerformance,
  Competitor,
  ContentCalendar,
  MediaAsset,
  PublishOutcome,
  CompetitorWorkspace,
  CreateSiteInput,
  DiscoveredChannelAccount,
  LinkChannelAccountInput,
  PublishIntent,
  UpdateChannelAccountInput,
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
  OsintWorkspace,
  PageRecord,
  ProjectContextJournalEntry,
  ProjectContextProfile,
  ProjectContextWorkspace,
  ProjectDeletionReceipt,
  ProjectImportResult,
  QrPlacement,
  QrStyle,
  RedirectConfigResponse,
  RedirectTarget,
  Report,
  RunEvidencePage,
  RunEvidenceSection,
  RunLinkExplorer,
  InternalLinkDirection,
  RunComparison,
  RunReplay,
  SearchTermRecord,
  SeoAction,
  Site,
  StartAuditInput,
  SystemHealth,
  UtmParameters,
  WorkspaceCapabilities,
} from "./contracts";

export const queryKeys = {
  sites: ["sites"] as const,
  capabilities: (siteId: string) => ["capabilities", siteId] as const,
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
  osint: (siteId: string, runId?: string) =>
    runId ? (["osint", siteId, runId] as const) : (["osint", siteId] as const),
  competitors: (siteId: string) => ["competitors", siteId] as const,
  monitoring: (siteId: string) => ["monitoring", siteId] as const,
  reports: (siteId: string) => ["reports", siteId] as const,
  integrations: (siteId: string) => ["integrations", siteId] as const,
  settings: (siteId: string) => ["settings", siteId] as const,
  extractionRules: (siteId: string) => ["extraction-rules", siteId] as const,
  extractionRuleTemplates: ["extraction-rule-templates"] as const,
  marketingReports: (siteId: string) => ["marketing-reports", siteId] as const,
  marketingReport: (reportId: string) =>
    ["marketing-report", reportId] as const,
  campaignLinks: (siteId: string) => ["campaign-links", siteId] as const,
  brandKit: (siteId: string) => ["brand-kit", siteId] as const,
  emailTemplates: (siteId: string) => ["email-templates", siteId] as const,
  emailTemplate: (templateId: string) =>
    ["email-template", templateId] as const,
  calendar: (siteId: string) => ["calendar", siteId] as const,
  mediaLibrary: (siteId: string) => ["media-library", siteId] as const,
  cabinets: (siteId: string) => ["cabinets", siteId] as const,
  cabinetDiscovery: (siteId: string) => ["cabinet-discovery", siteId] as const,
  cabinetPerformance: (cabinetId: string) =>
    ["cabinet-performance", cabinetId] as const,
  publishIntents: (siteId: string) => ["publish-intents", siteId] as const,
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

/**
 * What this workspace can do right now, and the remedy for anything it cannot.
 *
 * Read from the project route rather than the site-scoped compatibility layer,
 * because a capability answer is about the workspace itself.
 */
export function useCapabilities(siteId: string) {
  return useQuery({
    queryKey: queryKeys.capabilities(siteId),
    queryFn: ({ signal }) =>
      apiRequest<WorkspaceCapabilities>(`/projects/${siteId}/capabilities`, {
        signal,
      }),
    enabled: Boolean(siteId),
    staleTime: 30_000,
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

function isTerminalResearchRun(run: AuditRun): boolean {
  return ["succeeded", "completed", "partial"].includes(run.status);
}

/** Load the latest persisted public-web OSINT dossier and pass history. */
export function useOsintDossier(siteId: string) {
  const runs = useRuns(siteId);
  const researchRuns = (runs.data?.data.items ?? [])
    .filter((run) => run.workflowId === "osint-research")
    .sort((left, right) => {
      const leftAt = Date.parse(left.completedAt ?? left.startedAt);
      const rightAt = Date.parse(right.completedAt ?? right.startedAt);
      return rightAt - leftAt;
    });
  const latestRun = researchRuns[0];
  const latestTerminalRun = researchRuns.find(isTerminalResearchRun);

  const query = useQuery({
    queryKey: queryKeys.osint(siteId, latestTerminalRun?.id),
    queryFn: ({ signal }) =>
      apiRequest<OsintWorkspace>(withQuery("/osint", { siteId }), { signal }),
    enabled: Boolean(siteId),
  });

  return { ...query, latestRun };
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
  useSiteQuery<CompetitorWorkspace>(
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

/* ------------------------------------------------------------------ */
/* Ad cabinets                                                         */
/* ------------------------------------------------------------------ */

export const useCabinets = (siteId: string) =>
  useQuery({
    queryKey: queryKeys.cabinets(siteId),
    queryFn: ({ signal }) =>
      apiRequest<ListResponse<ChannelAccount>>(
        withQuery("/channels/accounts", { projectId: siteId, kind: "ads" }),
        { signal },
      ),
    enabled: Boolean(siteId),
  });

/**
 * Cabinets the credential can reach.
 *
 * Disabled by default and fetched on demand: this is the one query on the page
 * that leaves the machine, and it should happen because someone asked to see
 * their ad accounts, not because a tab was opened.
 */
export function useCabinetDiscovery(
  siteId: string,
  enabled: boolean,
  provider = "meta-ads",
) {
  return useQuery({
    queryKey: [...queryKeys.cabinetDiscovery(siteId), provider],
    queryFn: ({ signal }) =>
      apiRequest<ListResponse<DiscoveredChannelAccount>>(
        withQuery("/channels/discover", { projectId: siteId, provider }),
        { signal },
      ),
    enabled: Boolean(siteId) && enabled,
    retry: false,
    staleTime: 60_000,
  });
}

export const useCabinetPerformance = (cabinetId: string) =>
  useQuery({
    queryKey: queryKeys.cabinetPerformance(cabinetId),
    queryFn: ({ signal }) =>
      apiRequest<ChannelPerformance>(
        `/channels/accounts/${encodeURIComponent(cabinetId)}/performance`,
        { signal },
      ),
    enabled: Boolean(cabinetId),
  });

export function useLinkCabinet(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LinkChannelAccountInput) =>
      apiRequest<ChannelAccount>("/channels/accounts", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.cabinets(siteId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.cabinetDiscovery(siteId),
      });
      // Linking the first cabinet is what turns the `ads` capability on.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.capabilities(siteId),
      });
    },
  });
}

export function useUpdateCabinet(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateChannelAccountInput;
    }) =>
      apiRequest<ChannelAccount>(
        `/channels/accounts/${encodeURIComponent(id)}`,
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.cabinets(siteId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.capabilities(siteId),
      });
    },
  });
}

export function useRemoveCabinet(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/channels/accounts/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.cabinets(siteId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.capabilities(siteId),
      });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Cross-channel reports                                               */
/* ------------------------------------------------------------------ */

export const useMarketingReports = (siteId: string) =>
  useQuery({
    queryKey: queryKeys.marketingReports(siteId),
    queryFn: ({ signal }) =>
      apiRequest<ListResponse<MarketingReportSummary>>(
        withQuery("/marketing-reports", { projectId: siteId }),
        { signal },
      ),
    enabled: Boolean(siteId),
  });

export const useMarketingReport = (reportId: string) =>
  useQuery({
    queryKey: queryKeys.marketingReport(reportId),
    queryFn: ({ signal }) =>
      apiRequest<MarketingReport>(
        `/marketing-reports/${encodeURIComponent(reportId)}`,
        { signal },
      ),
    enabled: Boolean(reportId),
  });

export function useGenerateReport(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title?: string;
      start?: string;
      end?: string;
      compare?: boolean;
      narrative?: string | null;
    }) =>
      apiRequest<MarketingReport>("/marketing-reports", {
        method: "POST",
        body: JSON.stringify({
          projectId: siteId,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          ...input,
        }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.marketingReports(siteId),
      }),
  });
}

/* ------------------------------------------------------------------ */
/* Email builder                                                       */
/* ------------------------------------------------------------------ */

export const useBrandKit = (siteId: string) =>
  useQuery({
    queryKey: queryKeys.brandKit(siteId),
    queryFn: ({ signal }) =>
      apiRequest<BrandKitWorkspace>(
        `/projects/${encodeURIComponent(siteId)}/brand-kit`,
        { signal },
      ),
    enabled: Boolean(siteId),
  });

export function useReviseBrandKit(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { profile: BrandKitProfile; changeSummary: string }) =>
      apiRequest<BrandKitWorkspace>(
        `/projects/${encodeURIComponent(siteId)}/brand-kit`,
        { method: "PUT", body: JSON.stringify(input) },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.brandKit(siteId) }),
  });
}

export const useEmailTemplates = (siteId: string) =>
  useQuery({
    queryKey: queryKeys.emailTemplates(siteId),
    queryFn: ({ signal }) =>
      apiRequest<ListResponse<EmailTemplate>>(
        withQuery("/email-templates", { projectId: siteId }),
        { signal },
      ),
    enabled: Boolean(siteId),
  });

export const useEmailTemplate = (templateId: string) =>
  useQuery({
    queryKey: queryKeys.emailTemplate(templateId),
    queryFn: ({ signal }) =>
      apiRequest<EmailTemplateWorkspace>(
        `/email-templates/${encodeURIComponent(templateId)}`,
        { signal },
      ),
    enabled: Boolean(templateId),
  });

export function useCreateEmailTemplate(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; purpose?: string | null }) =>
      apiRequest<EmailTemplate>("/email-templates", {
        method: "POST",
        body: JSON.stringify({ projectId: siteId, ...input }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.emailTemplates(siteId),
      }),
  });
}

/**
 * Compiles and validates without storing.
 *
 * The editor calls this on every check, so a person sees the same report an
 * agent iterates against rather than a different, friendlier one.
 */
export function usePreviewEmail(siteId: string) {
  return useMutation({
    mutationFn: (input: {
      subject: string;
      preheader?: string;
      html: string;
    }) =>
      apiRequest<EmailPreview>(
        `/projects/${encodeURIComponent(siteId)}/email-preview`,
        { method: "POST", body: JSON.stringify(input) },
      ),
  });
}

export function useSaveEmailVersion(siteId: string, templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      subject: string;
      preheader?: string;
      html: string;
    }) =>
      apiRequest<EmailTemplateWorkspace>(
        `/email-templates/${encodeURIComponent(templateId)}/versions`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.emailTemplate(templateId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.emailTemplates(siteId),
      });
    },
  });
}

/** A client-safe starting document built from the current brand kit. */
export function useEmailStarter(siteId: string) {
  return useMutation({
    mutationFn: () =>
      apiRequest<{ html: string }>(
        `/projects/${encodeURIComponent(siteId)}/email-starter`,
      ),
  });
}

/* ------------------------------------------------------------------ */
/* Content calendar and media                                          */
/* ------------------------------------------------------------------ */

export const useCalendar = (siteId: string) =>
  useQuery({
    queryKey: queryKeys.calendar(siteId),
    queryFn: ({ signal }) =>
      apiRequest<ContentCalendar>(
        withQuery("/calendar", { projectId: siteId }),
        { signal },
      ),
    enabled: Boolean(siteId),
    // A scheduled post fires without anyone watching, so an open calendar
    // should notice within a minute rather than after a manual reload.
    refetchInterval: 60_000,
  });

export const useMediaLibrary = (siteId: string) =>
  useQuery({
    queryKey: queryKeys.mediaLibrary(siteId),
    queryFn: ({ signal }) =>
      apiRequest<ListResponse<MediaAsset>>(
        `/projects/${encodeURIComponent(siteId)}/media`,
        { signal },
      ),
    enabled: Boolean(siteId),
  });

export function useUploadMedia(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) =>
      apiRequest<MediaAsset>(`/projects/${encodeURIComponent(siteId)}/media`, {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
          // The name is for the operator to recognize the asset by; the
          // real media type comes from sniffing the bytes server-side.
          "x-marketingovo-filename": file.name,
        },
        body: await file.arrayBuffer(),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.mediaLibrary(siteId),
      }),
  });
}

/** Sends a local file to the operator's own storage so Instagram can fetch it. */
export function useRelayMedia(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mediaId: string) =>
      apiRequest<MediaAsset>(`/media/${encodeURIComponent(mediaId)}/relay`, {
        method: "POST",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.mediaLibrary(siteId),
      }),
  });
}

export function useAttachPublicUrl(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      mediaId,
      publicUrl,
    }: {
      mediaId: string;
      publicUrl: string;
    }) =>
      apiRequest<MediaAsset>(
        `/media/${encodeURIComponent(mediaId)}/public-url`,
        { method: "POST", body: JSON.stringify({ publicUrl }) },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.mediaLibrary(siteId),
      }),
  });
}

export function useScheduleIntent(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      intentId,
      scheduledAt,
      timezone,
    }: {
      intentId: string;
      scheduledAt: string;
      timezone: string;
    }) =>
      apiRequest<PublishIntent>(
        `/publish-intents/${encodeURIComponent(intentId)}/schedule`,
        { method: "POST", body: JSON.stringify({ scheduledAt, timezone }) },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.calendar(siteId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.publishIntents(siteId),
      });
    },
  });
}

/** Sends an approved post immediately. Refused for anything but the browser. */
export function usePublishNow(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (intentId: string) =>
      apiRequest<PublishOutcome>(
        `/publish-intents/${encodeURIComponent(intentId)}/publish-now`,
        { method: "POST" },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.calendar(siteId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.publishIntents(siteId),
      });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Campaign staging                                                    */
/* ------------------------------------------------------------------ */

export const usePublishIntents = (siteId: string) =>
  useQuery({
    queryKey: queryKeys.publishIntents(siteId),
    queryFn: ({ signal }) =>
      apiRequest<ListResponse<PublishIntent>>(
        withQuery("/publish-intents", { projectId: siteId, state: "staged" }),
        { signal },
      ),
    enabled: Boolean(siteId),
  });

/**
 * Approves one staged payload.
 *
 * The hash travels with the request on purpose: the daemon matches it against
 * the stored payload and refuses if they differ, so approving something that
 * changed after it was rendered is impossible rather than merely unlikely.
 */
export function useApprovePublishIntent(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payloadHash }: { id: string; payloadHash: string }) =>
      apiRequest<PublishIntent>(
        `/publish-intents/${encodeURIComponent(id)}/approve`,
        { method: "POST", body: JSON.stringify({ payloadHash }) },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.publishIntents(siteId),
      }),
  });
}

export function useWithdrawPublishIntent(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiRequest<PublishIntent>(
        `/publish-intents/${encodeURIComponent(id)}/withdraw`,
        { method: "POST", body: JSON.stringify({ note }) },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.publishIntents(siteId),
      }),
  });
}

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
  workflowId:
    | "compare"
    | "keyword-research"
    | "content-plan"
    | "osint-research"
    | "ads-audit";
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
              : input.workflowId === "osint-research"
                ? queryKeys.osint(input.projectId)
                : input.workflowId === "ads-audit"
                  ? queryKeys.cabinets(input.projectId)
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
  /**
   * What the schedule starts. Omitted means a site audit. Any registered
   * workflow id is legal — the editor offers two, but a schedule created over
   * the API keeps whatever it was created with.
   */
  workflowId?: string;
  options?: Record<string, unknown>;
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
        throw new Error("The .marketingovo file must be 25 MiB or smaller.");
      }
      const lowerName = file.name.toLowerCase();
      if (!lowerName.endsWith(".marketingovo")) {
        throw new Error("Choose a file with the .marketingovo extension.");
      }
      return apiRequest<ProjectImportResult>("/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/vnd.marketingovo.project+json",
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

/* ------------------------------------------------------------------ */
/* Campaign links and QR codes                                         */
/* ------------------------------------------------------------------ */

export const useCampaignLinks = (siteId: string) =>
  useQuery({
    queryKey: queryKeys.campaignLinks(siteId),
    queryFn: ({ signal }) =>
      apiRequest<ListResponse<CampaignLink>>(
        `/projects/${encodeURIComponent(siteId)}/campaign-links`,
        { signal },
      ),
    enabled: Boolean(siteId),
  });

/**
 * Checks tagging without saving it.
 *
 * A mutation rather than a query because it is driven by editing, not by
 * navigation — the point is to show what a tagging choice costs while it is
 * still free to change.
 */
export function usePreviewCampaignLink(siteId: string) {
  return useMutation({
    mutationFn: (input: {
      destinationUrl: string;
      utm: UtmParameters;
      style?: Partial<QrStyle>;
      placement?: QrPlacement;
      printedWidthMm?: number;
    }) =>
      apiRequest<CampaignLinkPreview>(
        `/projects/${encodeURIComponent(siteId)}/campaign-links/preview`,
        { method: "POST", body: JSON.stringify(input) },
      ),
  });
}

export function useCreateCampaignLink(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      label: string;
      destinationUrl: string;
      utm: UtmParameters;
      style?: Partial<QrStyle>;
      placement?: QrPlacement;
      printedWidthMm?: number;
    }) =>
      apiRequest<CampaignLink>(
        `/projects/${encodeURIComponent(siteId)}/campaign-links`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaignLinks(siteId),
      }),
  });
}

export function useMarkCampaignLinkPrinted(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) =>
      apiRequest<CampaignLink>(
        `/campaign-links/${encodeURIComponent(linkId)}/printed`,
        { method: "POST" },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaignLinks(siteId),
      }),
  });
}

export function useDeleteCampaignLink(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) =>
      apiRequest<void>(`/campaign-links/${encodeURIComponent(linkId)}`, {
        method: "DELETE",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaignLinks(siteId),
      }),
  });
}

export function useRedirectConfig(siteId: string) {
  return useMutation({
    mutationFn: (input: {
      target: RedirectTarget;
      shortHost?: string | null;
      linkIds?: string[];
      expiresAt?: string | null;
      fallbackUrl?: string | null;
    }) =>
      apiRequest<RedirectConfigResponse>(
        `/projects/${encodeURIComponent(siteId)}/campaign-links/redirect-config`,
        { method: "POST", body: JSON.stringify(input) },
      ),
  });
}

/**
 * The queries that triggered ads on one account.
 *
 * Google Ads only. A Meta cabinet returns an empty list rather than an error,
 * because "this provider reports no queries" is a fact about the provider.
 */
export function useSearchTerms(
  channelAccountId: string,
  enabled: boolean,
  options: { actionableOnly?: boolean; limit?: number } = {},
) {
  return useQuery({
    queryKey: [
      "search-terms",
      channelAccountId,
      options.actionableOnly ?? true,
      options.limit ?? 100,
    ],
    queryFn: ({ signal }) =>
      apiRequest<ListResponse<SearchTermRecord>>(
        withQuery(
          `/channels/accounts/${encodeURIComponent(channelAccountId)}/search-terms`,
          {
            actionableOnly: String(options.actionableOnly ?? true),
            limit: String(options.limit ?? 100),
          },
        ),
        { signal },
      ),
    enabled: Boolean(channelAccountId) && enabled,
  });
}
