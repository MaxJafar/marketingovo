import { join } from "node:path";
import { homedir } from "node:os";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import {
  AgentAdsAuditStartTool,
  AgentAdsCabinetsTool,
  AgentAdsPerformanceTool,
  AgentAuditStartTool,
  AgentBrandKitTool,
  AgentCampaignStageTool,
  AgentCompareStartTool,
  AgentEmailDraftTool,
  AgentEmailTemplatesTool,
  AgentContentPlanStartTool,
  AgentKeywordResearchStartTool,
  AgentCampaignLinkTool,
  AgentMarketingReportTool,
  AgentMonitoringStatusTool,
  AgentOsintResearchStartTool,
  AgentRunCompareTool,
  AgentRunEvidenceTool,
  AgentRunGetTool,
  AgentRunLinksTool,
  AgentSessionAttachTool,
  AgentSessionDetachTool,
  AgentSessionListTool,
  AgentSessionSayTool,
  AgentSessionWaitTool,
  PUBLIC_AGENT_TOOL_NAMES,
  TERMINAL_SESSION_TOOL_NAMES,
  type AgentAdsAuditStartInput,
  type AgentAdsCabinetsInput,
  type AgentAdsPerformanceInput,
  type AgentAuditStartInput,
  type AgentBrandKitInput,
  type AgentCampaignStageInput,
  type AgentCompareStartInput,
  type AgentEmailDraftInput,
  type AgentEmailTemplatesInput,
  type AgentContentPlanStartInput,
  type AgentKeywordResearchStartInput,
  type AgentCampaignLinkInput,
  type AgentMarketingReportInput,
  type AgentMonitoringStatusInput,
  type AgentOsintResearchStartInput,
  type AgentRunCompareInput,
  type AgentRunEvidenceInput,
  type AgentRunGetInput,
  type AgentRunLinksInput,
  type AgentSessionAttachInput,
  type AgentSessionDetachInput,
  type AgentSessionListInput,
  type AgentSessionSayInput,
  type AgentSessionWaitInput,
} from "@marketingovo/contracts/agent-tools";
import { MarketingovoClient } from "@marketingovo/sdk";
import { resolveMcpConnectionEnvironment } from "./compatibility.js";

export const PUBLIC_TOOL_NAMES = PUBLIC_AGENT_TOOL_NAMES;
export const SESSION_TOOL_NAMES = TERMINAL_SESSION_TOOL_NAMES;

const toMcpInputSchema = <Value>(schema: unknown): z.ZodType<Value> =>
  z.fromJSONSchema(
    schema as Parameters<typeof z.fromJSONSchema>[0],
  ) as z.ZodType<Value>;

const auditStartInputSchema = toMcpInputSchema<AgentAuditStartInput>(
  AgentAuditStartTool.inputSchema,
);
const runGetInputSchema = toMcpInputSchema<AgentRunGetInput>(
  AgentRunGetTool.inputSchema,
);
const runEvidenceInputSchema = toMcpInputSchema<AgentRunEvidenceInput>(
  AgentRunEvidenceTool.inputSchema,
);
const runLinksInputSchema = toMcpInputSchema<AgentRunLinksInput>(
  AgentRunLinksTool.inputSchema,
);
const runCompareInputSchema = toMcpInputSchema<AgentRunCompareInput>(
  AgentRunCompareTool.inputSchema,
);
const compareStartInputSchema = toMcpInputSchema<AgentCompareStartInput>(
  AgentCompareStartTool.inputSchema,
);
const keywordResearchStartInputSchema =
  toMcpInputSchema<AgentKeywordResearchStartInput>(
    AgentKeywordResearchStartTool.inputSchema,
  );
const contentPlanStartInputSchema =
  toMcpInputSchema<AgentContentPlanStartInput>(
    AgentContentPlanStartTool.inputSchema,
  );
const osintResearchStartInputSchema =
  toMcpInputSchema<AgentOsintResearchStartInput>(
    AgentOsintResearchStartTool.inputSchema,
  );
const monitoringStatusInputSchema =
  toMcpInputSchema<AgentMonitoringStatusInput>(
    AgentMonitoringStatusTool.inputSchema,
  );
const adsCabinetsInputSchema = toMcpInputSchema<AgentAdsCabinetsInput>(
  AgentAdsCabinetsTool.inputSchema,
);
const adsPerformanceInputSchema = toMcpInputSchema<AgentAdsPerformanceInput>(
  AgentAdsPerformanceTool.inputSchema,
);
const adsAuditStartInputSchema = toMcpInputSchema<AgentAdsAuditStartInput>(
  AgentAdsAuditStartTool.inputSchema,
);
const campaignStageInputSchema = toMcpInputSchema<AgentCampaignStageInput>(
  AgentCampaignStageTool.inputSchema,
);
const brandKitInputSchema = toMcpInputSchema<AgentBrandKitInput>(
  AgentBrandKitTool.inputSchema,
);
const marketingReportInputSchema = toMcpInputSchema<AgentMarketingReportInput>(
  AgentMarketingReportTool.inputSchema,
);
const campaignLinkInputSchema = toMcpInputSchema<AgentCampaignLinkInput>(
  AgentCampaignLinkTool.inputSchema,
);
const emailDraftInputSchema = toMcpInputSchema<AgentEmailDraftInput>(
  AgentEmailDraftTool.inputSchema,
);
const emailTemplatesInputSchema = toMcpInputSchema<AgentEmailTemplatesInput>(
  AgentEmailTemplatesTool.inputSchema,
);
const sessionListInputSchema = toMcpInputSchema<AgentSessionListInput>(
  AgentSessionListTool.inputSchema,
);
const sessionAttachInputSchema = toMcpInputSchema<AgentSessionAttachInput>(
  AgentSessionAttachTool.inputSchema,
);
const sessionWaitInputSchema = toMcpInputSchema<AgentSessionWaitInput>(
  AgentSessionWaitTool.inputSchema,
);
const sessionSayInputSchema = toMcpInputSchema<AgentSessionSayInput>(
  AgentSessionSayTool.inputSchema,
);
const sessionDetachInputSchema = toMcpInputSchema<AgentSessionDetachInput>(
  AgentSessionDetachTool.inputSchema,
);

export interface MarketingovoMcpOptions {
  client?: MarketingovoClient;
  baseUrl?: string;
  tokenFile?: string;
}

const textResult = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

function defaultMarketingovoDataDirectory(): string {
  // Preserve the persisted 1.x data root until the storage migration owns the
  // default-path cutover. Connection environment variables remain canonical.
  if (process.platform === "darwin")
    return join(homedir(), "Library", "Application Support", "Marketingovo");
  if (process.platform === "win32")
    return join(
      process.env.LOCALAPPDATA ?? process.env.APPDATA ?? homedir(),
      "Marketingovo",
    );
  return join(
    process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"),
    "marketingovo",
  );
}

export async function createMarketingovoMcpServer(
  options: MarketingovoMcpOptions = {},
): Promise<McpServer> {
  let client = options.client;
  if (!client) {
    const connectionEnvironment = resolveMcpConnectionEnvironment();
    client = await MarketingovoClient.fromTokenFile(
      options.tokenFile ??
        connectionEnvironment.tokenFile ??
        join(defaultMarketingovoDataDirectory(), "service-token"),
      { baseUrl: options.baseUrl ?? connectionEnvironment.baseUrl },
    );
  }
  const server = new McpServer(
    { name: "marketingovo", version: "1.1.0" },
    {
      instructions:
        "Use start tools only after identifying the project and reading its context resource. Runs are asynchronous: call marketingovo_run_get until terminal, then summarize evidence, confidence, effort, and the five highest-value actions. Respect ignored and false-positive classifications exposed by the project issue-review resource. Never ask for or transmit credentials through tools.\n\nOn paid media: a metric returned as null is a metric nobody measured, and it is never a zero. Say 'not measured' and give the stated reason rather than reporting 0 spend, 0 conversions, or a cost per result derived from a missing denominator. Reach and frequency have no window total by design. You may draft and stage a campaign with marketingovo_campaign_stage; you cannot approve or publish one, and no tool here does. Tell the marketer their drafts are waiting for approval in the dashboard rather than describing a campaign as launched.\n\nOn email: read marketingovo_brand_kit first, then write HTML and submit it to marketingovo_email_draft. Treat the returned findings as the specification — every one names a real client behaviour, so fix them and resubmit rather than explaining them away. Keep iterating without a template_id until nothing blocking or error-level remains, then save once. Email HTML is not web HTML: lay out with nested tables, put styles inline, give every image alt text and a width attribute, end every font stack with a generic family, and keep the whole document under 102KB. Marketingovo does not send email; say the HTML is ready to export.\n\nTo answer a marketer typing at the dashboard terminal, run this loop: marketingovo_session_list to find the session, marketingovo_session_attach to claim it, then marketingovo_session_wait to receive each turn. Answer with marketingovo_session_say, using kind 'thought' to narrate long work so the terminal does not look frozen, and kind 'message' for the answer itself. Keep polling with marketingovo_session_wait — it renews your lease, and an empty result simply means nobody has typed yet. Stop and discard the current answer when a wait returns cancel_requested. Call marketingovo_session_detach when the conversation ends.",
    },
  );

  server.registerTool(
    AgentAuditStartTool.name,
    {
      title: AgentAuditStartTool.title,
      description: AgentAuditStartTool.description,
      inputSchema: auditStartInputSchema,
      annotations: {
        title: AgentAuditStartTool.title,
        ...AgentAuditStartTool.annotations,
      },
    },
    async ({ project_id, goal, render_mode, collect_vitals, max_urls }) =>
      textResult(
        await client.runs.start({
          projectId: project_id,
          workflowId: "audit",
          goal,
          options: {
            renderMode: render_mode ?? "static",
            collectVitals: collect_vitals ?? false,
            ...(max_urls !== undefined ? { maxUrls: max_urls } : {}),
          },
        }),
      ),
  );

  server.registerTool(
    AgentRunGetTool.name,
    {
      title: AgentRunGetTool.title,
      description: AgentRunGetTool.description,
      inputSchema: runGetInputSchema,
      annotations: {
        title: AgentRunGetTool.title,
        ...AgentRunGetTool.annotations,
      },
    },
    async ({ run_id, include_issues }) => {
      const run = await client.runs.get(run_id);
      const terminal = ["succeeded", "partial"].includes(run.status);
      const issues =
        include_issues !== false && terminal
          ? await client.runs.issues(run_id)
          : [];
      let result: unknown = null;
      if (terminal && run.workflowId !== "audit") {
        try {
          const bytes = await client.reports.get(run_id, "json");
          result = JSON.parse(new TextDecoder().decode(bytes));
        } catch {
          // A terminal legacy run may predate persisted research reports.
        }
      }
      return textResult({
        run,
        issues,
        ...(result === null ? {} : { result }),
      });
    },
  );

  server.registerTool(
    AgentRunEvidenceTool.name,
    {
      title: AgentRunEvidenceTool.title,
      description: AgentRunEvidenceTool.description,
      inputSchema: runEvidenceInputSchema,
      annotations: {
        title: AgentRunEvidenceTool.title,
        ...AgentRunEvidenceTool.annotations,
      },
    },
    async ({ run_id, section, search, limit, offset }) =>
      textResult(
        await client.runs.evidence(run_id, {
          section: section ?? "crawl",
          ...(search === undefined ? {} : { search }),
          ...(limit === undefined ? {} : { limit }),
          ...(offset === undefined ? {} : { offset }),
        }),
      ),
  );

  server.registerTool(
    AgentRunLinksTool.name,
    {
      title: AgentRunLinksTool.title,
      description: AgentRunLinksTool.description,
      inputSchema: runLinksInputSchema,
      annotations: {
        title: AgentRunLinksTool.title,
        ...AgentRunLinksTool.annotations,
      },
    },
    async ({ run_id, page_url, direction, search, limit, offset }) =>
      textResult(
        await client.runs.links(run_id, {
          pageUrl: page_url,
          direction: direction ?? "inlinks",
          ...(search === undefined ? {} : { search }),
          ...(limit === undefined ? {} : { limit }),
          ...(offset === undefined ? {} : { offset }),
        }),
      ),
  );

  server.registerTool(
    AgentRunCompareTool.name,
    {
      title: AgentRunCompareTool.title,
      description: AgentRunCompareTool.description,
      inputSchema: runCompareInputSchema,
      annotations: {
        title: AgentRunCompareTool.title,
        ...AgentRunCompareTool.annotations,
      },
    },
    async ({ run_id, baseline_run_id }) =>
      textResult(await client.runs.compare(run_id, baseline_run_id)),
  );

  server.registerTool(
    AgentCompareStartTool.name,
    {
      title: AgentCompareStartTool.title,
      description: AgentCompareStartTool.description,
      inputSchema: compareStartInputSchema,
      annotations: {
        title: AgentCompareStartTool.title,
        ...AgentCompareStartTool.annotations,
      },
    },
    async ({ project_id, competitor_urls, max_urls }) =>
      textResult(
        await client.runs.start({
          projectId: project_id,
          workflowId: "compare",
          options: {
            competitorUrls: competitor_urls,
            maxUrls: max_urls ?? 30,
          },
        }),
      ),
  );

  server.registerTool(
    AgentKeywordResearchStartTool.name,
    {
      title: AgentKeywordResearchStartTool.title,
      description: AgentKeywordResearchStartTool.description,
      inputSchema: keywordResearchStartInputSchema,
      annotations: {
        title: AgentKeywordResearchStartTool.title,
        ...AgentKeywordResearchStartTool.annotations,
      },
    },
    async ({ project_id, seed }) =>
      textResult(
        await client.runs.start({
          projectId: project_id,
          workflowId: "keyword-research",
          options: { seed },
        }),
      ),
  );

  server.registerTool(
    AgentContentPlanStartTool.name,
    {
      title: AgentContentPlanStartTool.title,
      description: AgentContentPlanStartTool.description,
      inputSchema: contentPlanStartInputSchema,
      annotations: {
        title: AgentContentPlanStartTool.title,
        ...AgentContentPlanStartTool.annotations,
      },
    },
    async ({ project_id, seeds }) =>
      textResult(
        await client.runs.start({
          projectId: project_id,
          workflowId: "content-plan",
          options: { seeds },
        }),
      ),
  );

  server.registerTool(
    AgentOsintResearchStartTool.name,
    {
      title: AgentOsintResearchStartTool.title,
      description: AgentOsintResearchStartTool.description,
      inputSchema: osintResearchStartInputSchema,
      annotations: {
        title: AgentOsintResearchStartTool.title,
        ...AgentOsintResearchStartTool.annotations,
      },
    },
    async ({ project_id, target_urls, max_urls }) =>
      textResult(
        await client.runs.start({
          projectId: project_id,
          workflowId: "osint-research",
          options: {
            ...(target_urls ? { targetUrls: target_urls } : {}),
            ...(max_urls !== undefined ? { maxUrls: max_urls } : {}),
          },
        }),
      ),
  );

  server.registerTool(
    AgentMonitoringStatusTool.name,
    {
      title: AgentMonitoringStatusTool.title,
      description: AgentMonitoringStatusTool.description,
      inputSchema: monitoringStatusInputSchema,
      annotations: {
        title: AgentMonitoringStatusTool.title,
        ...AgentMonitoringStatusTool.annotations,
      },
    },
    async ({ project_id }) =>
      textResult({
        health: await client.health(),
        schedules: await client.schedules.list(project_id),
        runs: (await client.runs.list(project_id)).slice(0, 10),
      }),
  );

  /* ------------------------------------------------------------------ */
  /* Paid media                                                          */
  /*                                                                     */
  /* Full read access to what the cabinets measured, plus the ability to */
  /* draft and stage a campaign. No approve tool exists, and none should:*/
  /* approval is pinned to the browser's transport and the daemon        */
  /* refuses it for the service token this server authenticates with.    */
  /* ------------------------------------------------------------------ */

  server.registerTool(
    AgentAdsCabinetsTool.name,
    {
      title: AgentAdsCabinetsTool.title,
      description: AgentAdsCabinetsTool.description,
      inputSchema: adsCabinetsInputSchema,
      annotations: {
        title: AgentAdsCabinetsTool.title,
        ...AgentAdsCabinetsTool.annotations,
      },
    },
    async ({ project_id, include_archived }) =>
      textResult(
        await client.channels.list(project_id, {
          kind: "ads",
          ...(include_archived ? { includeArchived: true } : {}),
        }),
      ),
  );

  server.registerTool(
    AgentAdsPerformanceTool.name,
    {
      title: AgentAdsPerformanceTool.title,
      description: AgentAdsPerformanceTool.description,
      inputSchema: adsPerformanceInputSchema,
      annotations: {
        title: AgentAdsPerformanceTool.title,
        ...AgentAdsPerformanceTool.annotations,
      },
    },
    async ({ channel_account_id, start, end, include_search_terms }) => {
      const window = {
        ...(start ? { start } : {}),
        ...(end ? { end } : {}),
      };
      const performance = await client.channels.performance(
        channel_account_id,
        window,
      );
      if (!include_search_terms) return textResult(performance);

      const searchTerms = await client.channels.searchTerms(
        channel_account_id,
        { ...window, actionableOnly: true, limit: 200 },
      );
      return textResult({
        performance,
        searchTerms,
        // Stated in the result rather than only in the tool description,
        // because it is the caveat most likely to be lost between a long
        // response and a summary.
        searchTermScope:
          "These cover Search and Shopping only. Performance Max and Demand Gen report no queries at all, and Google withholds terms too rare to anonymise, so this list never accounts for all of an account's clicks. An empty or short list is not evidence that nothing is being wasted.",
      });
    },
  );

  server.registerTool(
    AgentAdsAuditStartTool.name,
    {
      title: AgentAdsAuditStartTool.title,
      description: AgentAdsAuditStartTool.description,
      inputSchema: adsAuditStartInputSchema,
      annotations: {
        title: AgentAdsAuditStartTool.title,
        ...AgentAdsAuditStartTool.annotations,
      },
    },
    async ({ project_id, start, end }) =>
      textResult(
        await client.runs.start({
          projectId: project_id,
          workflowId: "ads-audit",
          options: {
            ...(start ? { start } : {}),
            ...(end ? { end } : {}),
          },
        }),
      ),
  );

  server.registerTool(
    AgentCampaignStageTool.name,
    {
      title: AgentCampaignStageTool.title,
      description: AgentCampaignStageTool.description,
      inputSchema: campaignStageInputSchema,
      annotations: {
        title: AgentCampaignStageTool.title,
        ...AgentCampaignStageTool.annotations,
      },
    },
    async ({ project_id, brief_title, objective, audience, deliverables }) => {
      const brief = await client.campaigns.create({
        projectId: project_id,
        title: brief_title,
        objective,
        ...(audience ? { audience } : {}),
      });
      const written = [];
      for (const deliverable of deliverables) {
        written.push(
          await client.campaigns.addDeliverable(brief.id, {
            channel: deliverable.channel,
            body: deliverable.body,
            ...(deliverable.headline ? { headline: deliverable.headline } : {}),
            ...(deliverable.call_to_action
              ? { callToAction: deliverable.call_to_action }
              : {}),
            ...(deliverable.destination_url
              ? { destinationUrl: deliverable.destination_url }
              : {}),
            ...(deliverable.creative_notes
              ? { creativeNotes: deliverable.creative_notes }
              : {}),
          }),
        );
      }
      return textResult({
        brief,
        deliverables: written,
        // Said plainly in the tool result rather than only in the tool
        // description, because this is the sentence an agent should repeat to
        // the marketer instead of reporting the campaign as launched.
        status:
          "Drafted and saved locally. Nothing has been sent to Meta and no budget is committed. Open the Ad Cabinets page in the dashboard to review and approve.",
      });
    },
  );

  /* ------------------------------------------------------------------ */
  /* Email                                                               */
  /*                                                                     */
  /* Read the brand, write HTML, submit it, read what a real client will  */
  /* do with it, fix, repeat. The report is the point: it turns "write an */
  /* email that works in Outlook" from a thing a model has to remember    */
  /* into a thing it can check.                                           */
  /* ------------------------------------------------------------------ */

  server.registerTool(
    AgentBrandKitTool.name,
    {
      title: AgentBrandKitTool.title,
      description: AgentBrandKitTool.description,
      inputSchema: brandKitInputSchema,
      annotations: {
        title: AgentBrandKitTool.title,
        ...AgentBrandKitTool.annotations,
      },
    },
    async ({ project_id }) =>
      textResult(await client.email.brandKit(project_id)),
  );

  server.registerTool(
    AgentEmailTemplatesTool.name,
    {
      title: AgentEmailTemplatesTool.title,
      description: AgentEmailTemplatesTool.description,
      inputSchema: emailTemplatesInputSchema,
      annotations: {
        title: AgentEmailTemplatesTool.title,
        ...AgentEmailTemplatesTool.annotations,
      },
    },
    async ({ project_id, template_id }) =>
      textResult(
        template_id
          ? await client.email.template(template_id)
          : await client.email.templates(project_id),
      ),
  );

  server.registerTool(
    AgentEmailDraftTool.name,
    {
      title: AgentEmailDraftTool.title,
      description: AgentEmailDraftTool.description,
      inputSchema: emailDraftInputSchema,
      annotations: {
        title: AgentEmailDraftTool.title,
        ...AgentEmailDraftTool.annotations,
      },
    },
    async ({ project_id, subject, preheader, html, template_id }) => {
      const input = {
        subject,
        html,
        ...(preheader ? { preheader } : {}),
      };
      if (!template_id) {
        // The iteration path. Nothing is stored, so a model can submit as
        // many passes as the report takes without filling an operator's
        // history with drafts.
        return textResult(await client.email.preview(project_id, input));
      }
      const saved = await client.email.saveVersion(template_id, input);
      return textResult({
        template: saved.template,
        revision: saved.current?.revision ?? null,
        report: saved.current?.report ?? null,
        // Said in the result rather than only in the description, because this
        // is the sentence to repeat to the marketer.
        status:
          "Saved as a revision. Nothing has been sent — export the compiled HTML from the dashboard and paste it into your email service.",
      });
    },
  );

  server.registerTool(
    AgentMarketingReportTool.name,
    {
      title: AgentMarketingReportTool.title,
      description: AgentMarketingReportTool.description,
      inputSchema: marketingReportInputSchema,
      annotations: {
        title: AgentMarketingReportTool.title,
        ...AgentMarketingReportTool.annotations,
      },
    },
    async ({ project_id, report_id, start, end, narrative }) => {
      if (report_id) {
        return textResult(await client.marketingReports.get(report_id));
      }
      const report = await client.marketingReports.generate({
        projectId: project_id,
        ...(start ? { start } : {}),
        ...(end ? { end } : {}),
        ...(narrative ? { narrative } : {}),
        compare: true,
      });
      return textResult({
        report,
        // Repeated in the result because it is the instruction most likely to
        // be lost between a long tool response and a summary.
        reportingRules:
          "Report each channel's own figures. Do not add conversions across channels, do not present a total the report refused, and where a section says a source was unavailable, say that rather than treating it as zero.",
      });
    },
  );

  server.registerTool(
    AgentCampaignLinkTool.name,
    {
      title: AgentCampaignLinkTool.title,
      description: AgentCampaignLinkTool.description,
      inputSchema: campaignLinkInputSchema,
      annotations: {
        title: AgentCampaignLinkTool.title,
        ...AgentCampaignLinkTool.annotations,
      },
    },
    async ({
      project_id,
      destination_url,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      placement,
      printed_width_mm,
    }) => {
      if (!destination_url || !utm_source || !utm_medium || !utm_campaign) {
        return textResult({
          links: await client.campaignLinks.list(project_id),
          note: "Pass destination_url with utm_source, utm_medium and utm_campaign to build a new link.",
        });
      }

      const utm = {
        source: utm_source,
        medium: utm_medium,
        campaign: utm_campaign,
        term: utm_term ?? null,
        content: utm_content ?? null,
      };
      const request = {
        destinationUrl: destination_url,
        utm,
        ...(placement ? { placement } : {}),
        ...(printed_width_mm === undefined
          ? {}
          : { printedWidthMm: printed_width_mm }),
      };

      // Checked before anything is created. The point of this tool is that a
      // printed code cannot be corrected, so a problem found afterwards is
      // not a finding — it is a reprint.
      const preview = await client.campaignLinks.preview(project_id, request);
      const blocking = preview.findings.filter(
        (finding) => finding.severity === "blocking",
      );
      if (blocking.length > 0) {
        return textResult({
          created: false,
          blocking,
          suggestedUtm: preview.normalizedUtm,
          status:
            "No link was created. Fix the blocking findings and call this again — these problems cannot be corrected once a code is printed.",
        });
      }

      const link = await client.campaignLinks.create(project_id, {
        label: `${utm.campaign} — ${utm.source}`,
        destinationUrl: destination_url,
        utm,
        ...(placement ? { placement } : {}),
        ...(printed_width_mm === undefined
          ? {}
          : { printedWidthMm: printed_width_mm }),
      });

      return textResult({
        created: true,
        link,
        advice: preview.advice,
        warnings: preview.findings.filter(
          (finding) => finding.severity !== "blocking",
        ),
        qrSvgUrl: client.campaignLinks.qrUrl(link.id, "svg"),
        qrPngUrl: client.campaignLinks.qrUrl(link.id, "png"),
        status:
          "The code encodes the URL directly, so it never expires and no service resolves it. Report the printed width it was judged against — a code that is too small to scan is the one failure error correction cannot fix.",
      });
    },
  );

  /* ------------------------------------------------------------------ */
  /* Terminal sessions                                                   */
  /*                                                                     */
  /* These five turn this MCP server into the answering half of the      */
  /* dashboard's console. The loop an agent runs is: list → attach →     */
  /* wait → (work) → say → wait again. `wait` doubles as the lease       */
  /* heartbeat, so an agent that stops polling releases the session      */
  /* rather than holding it hostage.                                     */
  /* ------------------------------------------------------------------ */

  server.registerTool(
    AgentSessionListTool.name,
    {
      title: AgentSessionListTool.title,
      description: AgentSessionListTool.description,
      inputSchema: sessionListInputSchema,
      annotations: {
        title: AgentSessionListTool.title,
        ...AgentSessionListTool.annotations,
      },
    },
    async () => textResult(await client.terminal.list()),
  );

  server.registerTool(
    AgentSessionAttachTool.name,
    {
      title: AgentSessionAttachTool.title,
      description: AgentSessionAttachTool.description,
      inputSchema: sessionAttachInputSchema,
      annotations: {
        title: AgentSessionAttachTool.title,
        ...AgentSessionAttachTool.annotations,
      },
    },
    async ({ session_id, label, harness }) =>
      textResult(
        await client.terminal.attach(session_id, {
          label,
          harness: harness ?? "mcp",
        }),
      ),
  );

  server.registerTool(
    AgentSessionWaitTool.name,
    {
      title: AgentSessionWaitTool.title,
      description: AgentSessionWaitTool.description,
      inputSchema: sessionWaitInputSchema,
      annotations: {
        title: AgentSessionWaitTool.title,
        ...AgentSessionWaitTool.annotations,
      },
    },
    async ({ session_id, agent_id, wait_ms }) =>
      textResult(
        await client.terminal.wait(session_id, agent_id, wait_ms ?? 20_000),
      ),
  );

  server.registerTool(
    AgentSessionSayTool.name,
    {
      title: AgentSessionSayTool.title,
      description: AgentSessionSayTool.description,
      inputSchema: sessionSayInputSchema,
      annotations: {
        title: AgentSessionSayTool.title,
        ...AgentSessionSayTool.annotations,
      },
    },
    async ({ session_id, agent_id, text, kind, tool }) =>
      textResult(
        await client.terminal.say(session_id, {
          agentId: agent_id,
          text,
          kind: kind ?? "message",
          ...(tool ? { tool } : {}),
        }),
      ),
  );

  server.registerTool(
    AgentSessionDetachTool.name,
    {
      title: AgentSessionDetachTool.title,
      description: AgentSessionDetachTool.description,
      inputSchema: sessionDetachInputSchema,
      annotations: {
        title: AgentSessionDetachTool.title,
        ...AgentSessionDetachTool.annotations,
      },
    },
    async ({ session_id, agent_id }) => {
      await client.terminal.detach(session_id, agent_id);
      return textResult({ detached: true, sessionId: session_id });
    },
  );

  server.registerResource(
    "marketingovo-run",
    new ResourceTemplate("marketingovo://runs/{id}", {
      list: async () => ({
        resources: (await client.runs.list()).slice(0, 100).map((run) => ({
          uri: `marketingovo://runs/${run.id}`,
          name: `${run.workflowId} — ${run.status}`,
        })),
      }),
    }),
    {
      title: "Marketingovo run",
      description: "Canonical local run and issue state",
      mimeType: "application/json",
    },
    async (uri, { id }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              run: await client.runs.get(String(id)),
              issues: await client.runs.issues(String(id)),
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerResource(
    "marketingovo-run-report",
    new ResourceTemplate("marketingovo://runs/{id}/report", {
      list: undefined,
    }),
    {
      title: "Marketingovo run report",
      description: "Agent-ready run summary with top issues",
      mimeType: "application/json",
    },
    async (uri, { id }) => {
      const run = await client.runs.get(String(id));
      const issues = await client.runs.issues(String(id));
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              { run, topIssues: issues.slice(0, 25) },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerResource(
    "marketingovo-project-overview",
    new ResourceTemplate("marketingovo://projects/{id}/overview", {
      list: async () => ({
        resources: (await client.projects.list()).map((project) => ({
          uri: `marketingovo://projects/${project.id}/overview`,
          name: project.name,
        })),
      }),
    }),
    {
      title: "Marketingovo project overview",
      description: "Marketer overview and prioritized actions",
      mimeType: "application/json",
    },
    async (uri, { id }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            await client.projects.overview(String(id)),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerResource(
    "marketingovo-project-issues",
    new ResourceTemplate("marketingovo://projects/{id}/issues", {
      list: async () => ({
        resources: (await client.projects.list()).map((project) => ({
          uri: `marketingovo://projects/${project.id}/issues`,
          name: `${project.name} — issue review`,
        })),
      }),
    }),
    {
      title: "Marketingovo project issue review",
      description:
        "Latest project findings with evidence, occurrence counts, and marketer adjudications",
      mimeType: "application/json",
    },
    async (uri, { id }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            await client.issues.list(String(id), { limit: 250, offset: 0 }),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerResource(
    "marketingovo-project-ads",
    new ResourceTemplate("marketingovo://projects/{id}/ads", {
      list: async () => ({
        resources: (await client.projects.list()).map((project) => ({
          uri: `marketingovo://projects/${project.id}/ads`,
          name: `${project.name} — ad cabinets`,
        })),
      }),
    }),
    {
      title: "Marketingovo ad cabinets",
      description:
        "Linked Facebook and Instagram ad cabinets with their last measured window, split by platform. Unmeasured values are null with a stated reason, never zero.",
      mimeType: "application/json",
    },
    async (uri, { id }) => {
      const cabinets = await client.channels.list(String(id), { kind: "ads" });
      // Read sequentially rather than in parallel: this is a loopback daemon
      // over one SQLite file, and a fan-out here buys nothing but contention.
      const performance = [];
      for (const cabinet of cabinets) {
        performance.push(await client.channels.performance(cabinet.id));
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ cabinets, performance }, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    "marketingovo-project-context",
    new ResourceTemplate("marketingovo://projects/{id}/context", {
      list: async () => ({
        resources: (await client.projects.list()).map((project) => ({
          uri: `marketingovo://projects/${project.id}/context`,
          name: `${project.name} — business and SEO context`,
        })),
      }),
    }),
    {
      title: "Marketingovo project context",
      description:
        "Versioned business profile and append-only marketer decision journal",
      mimeType: "application/json",
    },
    async (uri, { id }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(await client.context.get(String(id)), null, 2),
        },
      ],
    }),
  );

  return server;
}
