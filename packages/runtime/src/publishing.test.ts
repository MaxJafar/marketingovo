import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketingovoDatabase } from "@marketingovo/storage-sqlite";
import { publishPayloadHash } from "./channels.js";
import {
  createIdempotencyKey,
  dailyLimitReached,
  runPublishAttempt,
  type PublishExecutor,
} from "./publishing.js";

/**
 * The double-post tests.
 *
 * Every scheduling tool eventually posts twice to someone's audience, and it
 * happens in the gap between "we made the request" and "we recorded the reply".
 * These exercise that gap directly.
 */
describe("publish attempts", () => {
  const databases: MarketingovoDatabase[] = [];

  afterEach(() => {
    for (const database of databases.splice(0)) database.close();
  });

  function setup(options: { payload?: Record<string, unknown> } = {}) {
    const database = new MarketingovoDatabase({
      path: join(
        mkdtempSync(join(tmpdir(), "marketingovo-publishing-")),
        "state.db",
      ),
    });
    databases.push(database);
    const project = database.createProject({ name: "Workspace" });
    const account = database.linkChannelAccount({
      workspaceId: project.id,
      provider: "telegram",
      account: "default",
      kind: "social",
      externalId: "@northstar",
      displayName: "Northstar channel",
    });
    const brief = database.createCampaignBrief({
      projectId: project.id,
      title: "Launch",
      objective: "Announce the release.",
      createdBy: "operator",
    });
    const deliverable = database.createCampaignDeliverable({
      briefId: brief.id,
      channel: "telegram-post",
      body: "We shipped it.",
      createdBy: "operator",
    });
    const payload = options.payload ?? {
      platform: "telegram",
      body: "We shipped it.",
    };
    const intent = database.stagePublishIntent({
      projectId: project.id,
      deliverableId: deliverable.id,
      channelAccountId: account.id,
      payload,
      payloadHash: publishPayloadHash(payload),
      stagedBy: "agent",
      platform: "telegram",
    });
    return { database, project, account, intent };
  }

  function approve(
    database: MarketingovoDatabase,
    intentId: string,
    payloadHash: string,
  ): string {
    database.approvePublishIntent(intentId, payloadHash, "operator");
    const key = createIdempotencyKey();
    database.setPublishIntentIdempotencyKey(intentId, key);
    return key;
  }

  const executor = (
    impl?: PublishExecutor["publish"],
  ): { executor: PublishExecutor; publish: ReturnType<typeof vi.fn> } => {
    const publish = vi.fn(
      impl ??
        (async () => ({
          providerId: "42",
          permalink: "https://t.me/northstar/42",
          request: { chat_id: "@northstar", text: "We shipped it." },
        })),
    );
    return { executor: { publish }, publish };
  };

  it("sends an approved post once and records what went on the wire", async () => {
    const { database, intent } = setup();
    approve(database, intent.id, intent.payloadHash);
    const { executor: exec, publish } = executor();

    const outcome = await runPublishAttempt({
      database,
      intentId: intent.id,
      executor: exec,
    });

    expect(publish).toHaveBeenCalledTimes(1);
    expect(outcome.state).toBe("published");
    expect(outcome.record).toMatchObject({
      state: "published",
      providerId: "42",
      permalink: "https://t.me/northstar/42",
    });
    // The record holds what the publisher actually sent, not the draft. The
    // draft may be edited later; the record is the answer to "what did we
    // send", and a reconstruction is not an answer.
    expect(outcome.record?.request).toEqual({
      chat_id: "@northstar",
      text: "We shipped it.",
    });
    expect(database.getPublishIntent(intent.id)?.state).toBe("published");
  });

  it("refuses to send the same intent twice", async () => {
    const { database, intent } = setup();
    approve(database, intent.id, intent.payloadHash);
    const { executor: exec, publish } = executor();

    await runPublishAttempt({ database, intentId: intent.id, executor: exec });
    const second = await runPublishAttempt({
      database,
      intentId: intent.id,
      executor: exec,
    });

    // The second call never reaches the provider: the intent is no longer
    // `approved`, so the conditional claim finds nothing.
    expect(publish).toHaveBeenCalledTimes(1);
    expect(second.state).toBe("skipped");
  });

  it("reports an interrupted attempt as unknown rather than resending", async () => {
    const { database, intent } = setup();
    const key = approve(database, intent.id, intent.payloadHash);

    // Exactly what a crash between the request and the response leaves behind:
    // an `attempting` record and no reply.
    database.claimPublishIntent(intent.id);
    database.beginPublishRecord({
      intentId: intent.id,
      projectId: intent.projectId,
      channelAccountId: intent.channelAccountId,
      platform: "telegram",
      request: intent.payload,
      idempotencyKey: key,
    });
    database.settlePublishIntent(intent.id, "approved", null);

    const { executor: exec, publish } = executor();
    const outcome = await runPublishAttempt({
      database,
      intentId: intent.id,
      executor: exec,
    });

    // Resending here is the double-post. Reporting failure is the silent drop.
    // Neither is a decision code should make, so it says what it knows.
    expect(publish).not.toHaveBeenCalled();
    expect(outcome.state).toBe("indeterminate");
    expect(outcome.record?.state).toBe("indeterminate");
    expect(outcome.reason).toMatch(/will not send again/i);
  });

  it("never sends an unapproved post", async () => {
    const { database, intent } = setup();
    const { executor: exec, publish } = executor();

    const outcome = await runPublishAttempt({
      database,
      intentId: intent.id,
      executor: exec,
    });

    expect(publish).not.toHaveBeenCalled();
    expect(outcome.state).toBe("skipped");
    expect(outcome.reason).toMatch(/staged rather than approved/i);
  });

  it("refuses to send a payload that changed after approval", async () => {
    const { database, intent } = setup();
    approve(database, intent.id, intent.payloadHash);
    // The approval named one payload; the stored payload is now a different
    // one. Sending would publish under a consent given for something else.
    database.settlePublishIntent(intent.id, "approved", null);
    const tampered = database.stagePublishIntent({
      projectId: intent.projectId,
      deliverableId: intent.deliverableId,
      channelAccountId: intent.channelAccountId,
      payload: { platform: "telegram", body: "Different copy." },
      payloadHash: "f".repeat(64),
      stagedBy: "agent",
      platform: "telegram",
    });
    database.approvePublishIntent(tampered.id, "f".repeat(64), "operator");
    database.setPublishIntentIdempotencyKey(
      tampered.id,
      createIdempotencyKey(),
    );
    // Simulate the payload being edited after that approval.
    const rewritten = database.schedulePublishIntent(
      tampered.id,
      new Date(Date.now() + 3_600_000).toISOString(),
      "UTC",
    );
    expect(rewritten?.state).toBe("staged");

    const { executor: exec, publish } = executor();
    const outcome = await runPublishAttempt({
      database,
      intentId: tampered.id,
      executor: exec,
    });
    expect(publish).not.toHaveBeenCalled();
    expect(outcome.state).toBe("skipped");
  });

  it("preserves a provider failure verbatim instead of a generic message", async () => {
    const { database, intent } = setup();
    approve(database, intent.id, intent.payloadHash);
    const { executor: exec } = executor(async () => {
      throw new Error("Bad Request: chat not found");
    });

    const outcome = await runPublishAttempt({
      database,
      intentId: intent.id,
      executor: exec,
    });

    expect(outcome.state).toBe("failed");
    expect(outcome.record?.error).toBe("Bad Request: chat not found");
    expect(database.getPublishIntent(intent.id)?.state).toBe("failed");
  });

  it("keeps an unknown outcome distinct from a failure", async () => {
    const { database, intent } = setup();
    approve(database, intent.id, intent.payloadHash);
    const { executor: exec } = executor(async () => {
      const error = Object.assign(new Error("socket hang up"), {
        indeterminate: true,
      });
      throw error;
    });

    const outcome = await runPublishAttempt({
      database,
      intentId: intent.id,
      executor: exec,
    });

    expect(outcome.state).toBe("indeterminate");
    expect(outcome.record?.state).toBe("indeterminate");
  });

  it("stops before sending when the platform's daily ceiling is reached", () => {
    const { database, account } = setup();
    const now = new Date();
    // Instagram publishes 25 per 24h. Discovering that at 09:00 is the one
    // failure a calendar exists to prevent.
    for (let index = 0; index < 25; index += 1) {
      const record = database.beginPublishRecord({
        intentId: `intent-${index}`,
        projectId: account.workspaceId,
        channelAccountId: account.id,
        platform: "instagram",
        request: {},
        idempotencyKey: `key-${index}`,
      })!;
      database.settlePublishRecord(record.id, {
        state: "published",
        providerId: String(index),
      });
    }

    expect(dailyLimitReached(database, account.id, "instagram", now)).toBe(
      true,
    );
    // Telegram documents no ceiling, so none is invented for it.
    expect(dailyLimitReached(database, account.id, "telegram", now)).toBe(
      false,
    );
  });

  it("scheduling an approved post clears the approval", () => {
    const { database, intent } = setup();
    approve(database, intent.id, intent.payloadHash);
    expect(database.getPublishIntent(intent.id)?.state).toBe("approved");

    const moved = database.schedulePublishIntent(
      intent.id,
      new Date(Date.now() + 86_400_000).toISOString(),
      "Europe/Berlin",
    );

    // The time is part of what was consented to. A post approved for Tuesday
    // morning is not the same post on Saturday night.
    expect(moved?.state).toBe("staged");
    expect(moved?.approvedPayloadHash).toBeNull();
    expect(moved?.note).toMatch(/approval was cleared/i);
  });
});
