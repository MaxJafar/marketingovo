import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MarketingovoLocalRuntime,
  publishPayloadHash,
} from "@marketingovo/runtime";
import { createLocalServer, type LocalServer } from "./index.js";

const HOST = "127.0.0.1:3210";
const ORIGIN = "http://127.0.0.1:3210";

/**
 * The approval gate from ADR 0005.
 *
 * An agent may draft a whole campaign and stage the exact payload. It may not
 * approve one. That boundary is enforced by transport — the browser's session
 * cookie versus the local service token — rather than by a role field or a
 * confirmation the model answers, because any control whose enforcement lives
 * inside the thing being controlled is not a control.
 */
describe("campaign approval boundary", () => {
  const servers: LocalServer[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  async function setup() {
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-campaign-approval-")),
    });
    const server = await createLocalServer({ runtime, port: 3210 });
    servers.push(server);
    const serviceToken = readFileSync(server.serviceTokenPath, "utf8").trim();

    // The service token is what agent tooling holds.
    const agentHeaders = {
      host: HOST,
      authorization: `Bearer ${serviceToken}`,
      origin: ORIGIN,
    };

    // A browser session, obtained the way the dashboard obtains one.
    const ticket = await server.app.inject({
      method: "POST",
      url: "/api/v1/session/bootstrap-token",
      headers: { host: HOST, authorization: `Bearer ${serviceToken}` },
    });
    const exchanged = await server.app.inject({
      method: "POST",
      url: "/api/v1/session/bootstrap",
      headers: { host: HOST },
      payload: { token: (ticket.json() as { token: string }).token },
    });
    const setCookieHeader = exchanged.headers["set-cookie"];
    const cookie = (
      Array.isArray(setCookieHeader)
        ? setCookieHeader
        : [String(setCookieHeader)]
    )
      .find((value) => value.startsWith("marketingovo_session="))!
      .split(";", 1)[0]!;
    const operatorHeaders = {
      host: HOST,
      cookie,
      origin: ORIGIN,
      "x-marketingovo-csrf": (exchanged.json() as { csrf: string }).csrf,
    };

    const project = await runtime.projects.create({
      name: "Paid workspace",
      canonicalUrl: "https://example.com",
    });
    const cabinet = await runtime.channels.link({
      projectId: project.id,
      provider: "meta-ads",
      kind: "ads",
      externalId: "act_123456",
      displayName: "Northstar — EU",
      currency: "EUR",
      dailySpendCap: 100,
    });

    return {
      server,
      runtime,
      agentHeaders,
      operatorHeaders,
      projectId: project.id,
      cabinetId: cabinet.id,
    };
  }

  /** Drafts a brief and a deliverable exactly as an agent would. */
  async function draft(
    server: LocalServer,
    headers: Record<string, string>,
    projectId: string,
  ) {
    const brief = await server.app.inject({
      method: "POST",
      url: "/api/v1/campaigns",
      headers,
      payload: {
        projectId,
        title: "Summer launch",
        objective: "Drive trial signups from Instagram.",
      },
    });
    expect(brief.statusCode).toBe(201);
    const briefId = (brief.json() as { id: string }).id;

    const deliverable = await server.app.inject({
      method: "POST",
      url: `/api/v1/campaigns/${briefId}/deliverables`,
      headers,
      payload: {
        channel: "instagram-ad",
        headline: "Ship faster",
        body: "Try it free for fourteen days.",
        destinationUrl: "https://example.com/trial",
      },
    });
    expect(deliverable.statusCode).toBe(201);
    return {
      briefId,
      deliverableId: (deliverable.json() as { id: string }).id,
    };
  }

  it("lets an agent draft and stage a campaign", async () => {
    const context = await setup();
    const { deliverableId } = await draft(
      context.server,
      context.agentHeaders,
      context.projectId,
    );

    const staged = await context.server.app.inject({
      method: "POST",
      url: `/api/v1/projects/${context.projectId}/publish-intents`,
      headers: context.agentHeaders,
      payload: {
        deliverableId,
        channelAccountId: context.cabinetId,
        payload: { name: "Summer launch", objective: "OUTCOME_TRAFFIC" },
        budget: { dailyBudget: 40, currency: "EUR" },
      },
    });

    expect(staged.statusCode).toBe(201);
    const intent = staged.json() as { state: string; stagedBy: string };
    expect(intent.state).toBe("staged");
    // Authorship is decided by transport, so the record says truthfully that a
    // model wrote this rather than trusting a field the caller supplied.
    expect(intent.stagedBy).toBe("agent");
  });

  it("refuses approval from the agent's service token", async () => {
    const context = await setup();
    const { deliverableId } = await draft(
      context.server,
      context.agentHeaders,
      context.projectId,
    );
    const staged = await context.server.app.inject({
      method: "POST",
      url: `/api/v1/projects/${context.projectId}/publish-intents`,
      headers: context.agentHeaders,
      payload: {
        deliverableId,
        channelAccountId: context.cabinetId,
        payload: { name: "Summer launch" },
        budget: { dailyBudget: 40, currency: "EUR" },
      },
    });
    const intent = staged.json() as { id: string; payloadHash: string };

    const refused = await context.server.app.inject({
      method: "POST",
      url: `/api/v1/publish-intents/${intent.id}/approve`,
      headers: context.agentHeaders,
      payload: { payloadHash: intent.payloadHash },
    });

    // The service token is fully authorized everywhere else in this API. This
    // is the one operation it cannot perform, and that asymmetry is the point.
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({
      code: "approval_requires_operator",
    });
    expect(context.runtime.database.getPublishIntent(intent.id)?.state).toBe(
      "staged",
    );
  });

  it("accepts approval from a browser session and records the exact payload", async () => {
    const context = await setup();
    const { deliverableId } = await draft(
      context.server,
      context.agentHeaders,
      context.projectId,
    );
    const payload = { name: "Summer launch", objective: "OUTCOME_TRAFFIC" };
    const staged = await context.server.app.inject({
      method: "POST",
      url: `/api/v1/projects/${context.projectId}/publish-intents`,
      headers: context.agentHeaders,
      payload: {
        deliverableId,
        channelAccountId: context.cabinetId,
        payload,
        budget: { dailyBudget: 40, currency: "EUR" },
      },
    });
    const intent = staged.json() as { id: string; payloadHash: string };
    expect(intent.payloadHash).toBe(publishPayloadHash(payload));

    const approved = await context.server.app.inject({
      method: "POST",
      url: `/api/v1/publish-intents/${intent.id}/approve`,
      headers: context.operatorHeaders,
      payload: { payloadHash: intent.payloadHash },
    });

    expect(approved.statusCode).toBe(200);
    expect(approved.json()).toMatchObject({
      state: "approved",
      approvedBy: "operator",
      approvedPayloadHash: intent.payloadHash,
    });
  });

  it("refuses an approval that names a payload the operator did not read", async () => {
    const context = await setup();
    const { deliverableId } = await draft(
      context.server,
      context.agentHeaders,
      context.projectId,
    );
    const staged = await context.server.app.inject({
      method: "POST",
      url: `/api/v1/projects/${context.projectId}/publish-intents`,
      headers: context.agentHeaders,
      payload: {
        deliverableId,
        channelAccountId: context.cabinetId,
        payload: { name: "Summer launch" },
        budget: { dailyBudget: 40, currency: "EUR" },
      },
    });
    const intent = staged.json() as { id: string };

    const stale = await context.server.app.inject({
      method: "POST",
      url: `/api/v1/publish-intents/${intent.id}/approve`,
      headers: context.operatorHeaders,
      payload: { payloadHash: "0".repeat(64) },
    });

    // An approval of a payload nobody saw is a record of consent that was not
    // informed, which is worse than having no record at all.
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ code: "intent_payload_changed" });
  });

  it("refuses to stage a budget above the cabinet's locally set cap", async () => {
    const context = await setup();
    const { deliverableId } = await draft(
      context.server,
      context.agentHeaders,
      context.projectId,
    );

    const refused = await context.server.app.inject({
      method: "POST",
      url: `/api/v1/projects/${context.projectId}/publish-intents`,
      headers: context.agentHeaders,
      payload: {
        deliverableId,
        channelAccountId: context.cabinetId,
        payload: { name: "Runaway" },
        // A daily budget wrong by a factor of a hundred is the failure this
        // cap exists for, and it is refused here rather than warned about.
        budget: { dailyBudget: 4_000, currency: "EUR" },
      },
    });

    expect(refused.statusCode).toBe(422);
    expect(refused.json()).toMatchObject({ code: "spend_cap_exceeded" });
  });

  it("refuses to send a post now from the agent's service token", async () => {
    const context = await setup();
    const { deliverableId } = await draft(
      context.server,
      context.agentHeaders,
      context.projectId,
    );
    const staged = await context.server.app.inject({
      method: "POST",
      url: `/api/v1/projects/${context.projectId}/publish-intents`,
      headers: context.agentHeaders,
      payload: {
        deliverableId,
        channelAccountId: context.cabinetId,
        payload: { platform: "telegram", body: "Ship it." },
      },
    });
    const intent = staged.json() as { id: string };

    const refused = await context.server.app.inject({
      method: "POST",
      url: `/api/v1/publish-intents/${intent.id}/publish-now`,
      headers: context.agentHeaders,
    });

    // Publishing is the moment something becomes public under the operator's
    // name. The transport is what decides a person did it.
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({
      code: "approval_requires_operator",
    });
  });

  it("lets an agent propose a time, because scheduling cannot cause a send", async () => {
    const context = await setup();
    const { deliverableId } = await draft(
      context.server,
      context.agentHeaders,
      context.projectId,
    );
    const staged = await context.server.app.inject({
      method: "POST",
      url: `/api/v1/projects/${context.projectId}/publish-intents`,
      headers: context.agentHeaders,
      payload: {
        deliverableId,
        channelAccountId: context.cabinetId,
        payload: { platform: "telegram", body: "Ship it." },
      },
    });
    const intent = staged.json() as { id: string; payloadHash: string };

    const scheduled = await context.server.app.inject({
      method: "POST",
      url: `/api/v1/publish-intents/${intent.id}/schedule`,
      headers: context.agentHeaders,
      payload: {
        scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
        timezone: "Europe/Berlin",
      },
    });

    expect(scheduled.statusCode).toBe(200);
    // Still unapproved, so the time an agent chose cannot publish anything on
    // its own — a person approves the post at that time first.
    expect(scheduled.json()).toMatchObject({ state: "staged" });
  });

  it("refuses a scheduled time in the past", async () => {
    const context = await setup();
    const { deliverableId } = await draft(
      context.server,
      context.agentHeaders,
      context.projectId,
    );
    const staged = await context.server.app.inject({
      method: "POST",
      url: `/api/v1/projects/${context.projectId}/publish-intents`,
      headers: context.agentHeaders,
      payload: {
        deliverableId,
        channelAccountId: context.cabinetId,
        payload: { platform: "telegram", body: "Ship it." },
      },
    });
    const intent = staged.json() as { id: string };

    const refused = await context.server.app.inject({
      method: "POST",
      url: `/api/v1/publish-intents/${intent.id}/schedule`,
      headers: context.agentHeaders,
      payload: {
        scheduledAt: new Date(Date.now() - 86_400_000).toISOString(),
        timezone: "UTC",
      },
    });

    // A past time would fire the instant it is approved, which is a
    // surprising way to publish under someone's brand.
    expect(refused.statusCode).toBe(422);
  });

  it("refuses to send a local file to public storage from the service token", async () => {
    const context = await setup();
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48,
      0x44, 0x52, 0, 0, 0x02, 0x80, 0, 0, 0x01, 0xe0,
    ]);
    const uploaded = await context.server.app.inject({
      method: "POST",
      url: `/api/v1/projects/${context.projectId}/media`,
      headers: {
        ...context.agentHeaders,
        "content-type": "application/octet-stream",
        "x-marketingovo-filename": "hero.png",
      },
      payload: png,
    });
    expect(uploaded.statusCode).toBe(201);
    // The type comes from the bytes, and the dimensions with it.
    expect(uploaded.json()).toMatchObject({
      mediaType: "image/png",
      kind: "image",
      width: 640,
      height: 480,
      publicUrl: null,
    });

    const asset = uploaded.json() as { id: string };
    const refused = await context.server.app.inject({
      method: "POST",
      url: `/api/v1/media/${asset.id}/relay`,
      headers: context.agentHeaders,
    });

    // "My files stay on my machine" is a property a person relaxes, not an
    // agent.
    expect(refused.statusCode).toBe(403);
  });

  it("refuses an upload whose bytes are not a supported media file", async () => {
    const context = await setup();
    const refused = await context.server.app.inject({
      method: "POST",
      url: `/api/v1/projects/${context.projectId}/media`,
      headers: {
        ...context.agentHeaders,
        "content-type": "application/octet-stream",
        // Named like an image, and it is not one. The name is not evidence.
        "x-marketingovo-filename": "photo.png",
      },
      payload: Buffer.from("#!/bin/sh\necho not a png\n"),
    });

    expect(refused.statusCode).toBe(400);
    expect(refused.json()).toMatchObject({ code: "media_unsupported" });
  });

  it("keeps the set of outward-acting routes explicit", async () => {
    const context = await setup();
    const paths = Object.keys(
      (context.server.app.swagger() as { paths: Record<string, unknown> })
        .paths,
    );

    // Every route that publishes, approves a publish, or sends a local file
    // off this machine. The list is literal so that adding a fourth requires
    // editing this line and deciding, deliberately, which transport may reach
    // it — each of the three below has its own 403 test above.
    expect(
      paths
        .filter((path) => /(publish-now|approve|\/relay$)/u.test(path))
        .sort(),
    ).toEqual([
      "/api/v1/media/{id}/relay",
      "/api/v1/publish-intents/{id}/approve",
      "/api/v1/publish-intents/{id}/publish-now",
    ]);
  });
});
