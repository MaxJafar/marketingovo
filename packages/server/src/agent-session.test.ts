import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MarketingovoLocalRuntime } from "@marketingovo/runtime";
import { AgentSessionStore } from "./agent-session.js";
import { createLocalServer, type LocalServer } from "./index.js";

const HOST = "127.0.0.1:3210";

describe("agent session store", () => {
  it("hands a waiting agent the turn a human typed", async () => {
    const store = new AgentSessionStore();
    const session = store.create(null);
    const { attachment } = store.attach(session.id, {
      label: "Claude Code",
      harness: "mcp",
    });

    const pending = store.wait(session.id, attachment.agentId, 5_000);
    store.say(session.id, "audit the blog");

    const result = await pending;
    expect(result.messages.map((event) => event.text)).toEqual([
      "audit the blog",
    ]);
    expect(result.cancelRequested).toBe(false);
    store.dispose();
  });

  it("delivers a turn spoken before the agent asked for it", async () => {
    const store = new AgentSessionStore();
    const session = store.create(null);
    store.say(session.id, "first question");
    const { attachment, backlog } = store.attach(session.id, {
      label: "Codex",
      harness: "mcp",
    });

    // Attaching drains what was already queued, so a harness that starts after
    // the marketer has typed does not answer into a void.
    expect(backlog.map((event) => event.text)).toEqual(["first question"]);

    store.say(session.id, "second question");
    const result = await store.wait(session.id, attachment.agentId, 0);
    expect(result.messages.map((event) => event.text)).toEqual([
      "second question",
    ]);
    store.dispose();
  });

  it("never hands the same turn to two waiting agents", async () => {
    const store = new AgentSessionStore();
    const session = store.create(null);
    const { attachment } = store.attach(session.id, {
      label: "Claude Code",
      harness: "mcp",
    });

    const first = store.wait(session.id, attachment.agentId, 5_000);
    const second = store.wait(session.id, attachment.agentId, 200);
    store.say(session.id, "only once");

    const [firstResult, secondResult] = await Promise.all([first, second]);
    const delivered = [...firstResult.messages, ...secondResult.messages];
    expect(delivered).toHaveLength(1);
    expect(delivered[0]?.text).toBe("only once");
    store.dispose();
  });

  it("refuses a second agent while the first holds the lease", () => {
    const store = new AgentSessionStore();
    const session = store.create(null);
    store.attach(session.id, { label: "Claude Code", harness: "mcp" });

    expect(() =>
      store.attach(session.id, { label: "Codex", harness: "mcp" }),
    ).toThrowError(/already holds this session/);
    store.dispose();
  });

  it("releases a lapsed lease so a crashed harness does not hold the console", () => {
    let clock = 1_000;
    const store = new AgentSessionStore({
      leaseMs: 500,
      now: () => clock,
    });
    const session = store.create(null);
    store.attach(session.id, { label: "Claude Code", harness: "mcp" });
    expect(store.presence(session.id).attached).toBe(true);

    clock += 5_000;
    expect(store.presence(session.id).attached).toBe(false);

    // The seat is now free, and the transcript says why rather than going quiet.
    const reattached = store.attach(session.id, {
      label: "Codex",
      harness: "mcp",
    });
    expect(reattached.attachment.label).toBe("Codex");
    const texts = store.transcript(session.id).events.map((e) => e.text);
    expect(texts.some((text) => text.includes("lease lapsed"))).toBe(true);
    store.dispose();
  });

  it("surfaces an interrupt on the next poll", async () => {
    const store = new AgentSessionStore();
    const session = store.create(null);
    const { attachment } = store.attach(session.id, {
      label: "Claude Code",
      harness: "mcp",
    });

    const waiting = store.wait(session.id, attachment.agentId, 5_000);
    store.cancel(session.id);
    const result = await waiting;
    expect(result.cancelRequested).toBe(true);
    store.dispose();
  });

  it("rejects emitting from an agent that does not hold the session", () => {
    const store = new AgentSessionStore();
    const session = store.create(null);
    expect(() =>
      store.emit(session.id, { kind: "message", text: "hello" }),
    ).toThrowError(/Attach to the session/);
    store.dispose();
  });

  it("streams appended events to a subscribed terminal", () => {
    const store = new AgentSessionStore();
    const session = store.create(null);
    const seen: string[] = [];
    const unsubscribe = store.subscribe(session.id, (envelope) => {
      if (envelope.type === "event" && envelope.event) {
        seen.push(envelope.event.text);
      }
    });

    const { attachment } = store.attach(session.id, {
      label: "Claude Code",
      harness: "mcp",
    });
    store.say(session.id, "what changed");
    store.emit(session.id, { kind: "message", text: "three pages regressed" });

    expect(attachment.label).toBe("Claude Code");
    expect(seen).toContain("what changed");
    expect(seen).toContain("three pages regressed");
    unsubscribe();
    store.dispose();
  });
});

describe("agent session API", () => {
  const servers: LocalServer[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  async function setup() {
    const runtime = new MarketingovoLocalRuntime({
      dataDir: mkdtempSync(join(tmpdir(), "marketingovo-agent-session-")),
    });
    const server = await createLocalServer({ runtime, port: 3210 });
    servers.push(server);
    const token = readFileSync(server.serviceTokenPath, "utf8").trim();
    return {
      server,
      headers: { host: HOST, authorization: `Bearer ${token}` },
    };
  }

  it("carries a turn from the browser to an attached agent and back", async () => {
    const { server, headers } = await setup();

    const created = await server.app.inject({
      method: "POST",
      url: "/api/v1/agent/sessions",
      headers,
      payload: {},
    });
    expect(created.statusCode).toBe(201);
    const sessionId = (created.json() as { data: { id: string } }).data.id;

    const attached = await server.app.inject({
      method: "POST",
      url: `/api/v1/agent/sessions/${sessionId}/attach`,
      headers,
      payload: { label: "Claude Code", harness: "mcp" },
    });
    expect(attached.statusCode).toBe(200);
    const agentId = (attached.json() as { data: { agentId: string } }).data
      .agentId;

    const said = await server.app.inject({
      method: "POST",
      url: `/api/v1/agent/sessions/${sessionId}/messages`,
      headers,
      payload: { text: "how is organic traffic trending" },
    });
    expect(said.statusCode).toBe(201);

    const waited = await server.app.inject({
      method: "POST",
      url: `/api/v1/agent/sessions/${sessionId}/wait`,
      headers,
      payload: { agentId, waitMs: 0 },
    });
    expect(waited.json()).toMatchObject({
      data: {
        messages: [{ text: "how is organic traffic trending", role: "user" }],
        cancelRequested: false,
      },
    });

    const emitted = await server.app.inject({
      method: "POST",
      url: `/api/v1/agent/sessions/${sessionId}/emit`,
      headers,
      payload: { agentId, kind: "message", text: "up 18.2% over 30 days" },
    });
    expect(emitted.statusCode).toBe(201);

    const transcript = await server.app.inject({
      method: "GET",
      url: `/api/v1/agent/sessions/${sessionId}`,
      headers,
    });
    const body = transcript.json() as {
      data: {
        events: Array<{ role: string; text: string }>;
        presence: { attached: boolean };
      };
    };
    expect(body.data.presence.attached).toBe(true);
    expect(
      body.data.events.some(
        (event) =>
          event.role === "agent" && event.text === "up 18.2% over 30 days",
      ),
    ).toBe(true);
  });

  it("rejects an emit from an agent id that does not hold the session", async () => {
    const { server, headers } = await setup();
    const created = await server.app.inject({
      method: "POST",
      url: "/api/v1/agent/sessions",
      headers,
      payload: {},
    });
    const sessionId = (created.json() as { data: { id: string } }).data.id;
    await server.app.inject({
      method: "POST",
      url: `/api/v1/agent/sessions/${sessionId}/attach`,
      headers,
      payload: { label: "Claude Code", harness: "mcp" },
    });

    const stolen = await server.app.inject({
      method: "POST",
      url: `/api/v1/agent/sessions/${sessionId}/emit`,
      headers,
      payload: {
        agentId: "not-the-attached-agent",
        kind: "message",
        text: "impersonation attempt",
      },
    });
    expect(stolen.statusCode).toBe(409);
    expect(stolen.json()).toMatchObject({ code: "agent_not_attached" });
  });

  it("requires authentication and reports a missing session as 404", async () => {
    const { server, headers } = await setup();

    const anonymous = await server.app.inject({
      method: "GET",
      url: "/api/v1/agent/sessions",
      headers: { host: HOST },
    });
    expect(anonymous.statusCode).toBe(401);

    const missing = await server.app.inject({
      method: "GET",
      url: "/api/v1/agent/sessions/does-not-exist",
      headers,
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ code: "session_not_found" });
  });
});
