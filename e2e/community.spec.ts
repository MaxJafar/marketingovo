import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, resolve } from "node:path";
import { once } from "node:events";
import axeCore from "axe-core";
import { test, expect, type Page } from "@playwright/test";

const repositoryRoot = resolve(process.cwd());
const fixtureRoot = resolve(repositoryRoot, "examples/demo-site");
const routeFiles = new Map([
  ["/", "index.html"],
  ["/untitled", "untitled.html"],
  ["/no-h1", "no-h1.html"],
  ["/image", "image.html"],
  ["/duplicate-a", "duplicate-a.html"],
  ["/duplicate-b", "duplicate-b.html"],
  ["/missing-meta", "missing-meta.html"],
  ["/long-title", "long-title.html"],
  ["/long-description", "long-description.html"],
  ["/multiple-h1", "multiple-h1.html"],
  ["/no-canonical", "no-canonical.html"],
  ["/noindex", "noindex.html"],
  ["/no-viewport", "no-viewport.html"],
  ["/duplicate-id", "duplicate-id.html"],
  ["/bad-jsonld", "bad-jsonld.html"],
  ["/very-thin", "very-thin.html"],
  ["/soft-404", "soft-404.html"],
  ["/picture-no-fallback", "picture-no-fallback.html"],
  ["/canonical-broken", "canonical-broken.html"],
  ["/redirect-target", "redirect-target.html"],
  ["/healthy-a", "healthy-a.html"],
  ["/healthy-b", "healthy-b.html"],
  ["/pixel.svg", "pixel.svg"],
]);

let dataDirectory = "";
let dashboardUrl = "";
let fixtureOrigin = "";
let fixtureServer: Server | undefined;
let daemon: ChildProcessWithoutNullStreams | undefined;

const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoWcagViolations(
  page: Page,
  state: string,
): Promise<void> {
  await page.evaluate(axeCore.source);
  const violations = await page.evaluate(async (tags) => {
    const axe = (
      window as typeof window & {
        axe: {
          run: (
            context: Document,
            options: Record<string, unknown>,
          ) => Promise<{
            violations: Array<{
              id: string;
              impact: string | null;
              help: string;
              nodes: Array<{
                target: unknown;
                failureSummary?: string;
              }>;
            }>;
          }>;
        };
      }
    ).axe;
    const result = await axe.run(document, {
      runOnly: { type: "tag", values: tags },
      resultTypes: ["violations"],
    });
    return result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        failureSummary: node.failureSummary,
      })),
    }));
  }, wcagTags);
  expect(
    violations,
    `${state} has automated WCAG 2.0/2.1/2.2 A/AA violations:\n${JSON.stringify(violations, null, 2)}`,
  ).toEqual([]);
}

function longCopy(route: string): string {
  const stem = route.replace(/\W+/gu, "") || "index";
  return Array.from(
    { length: 18 },
    (_, index) =>
      `The ${stem} benchmark page gives teams clear search data so they can plan useful changes and verify results with calm review number ${index + 1}.`,
  ).join(" ");
}

async function startFixture(): Promise<{ server: Server; origin: string }> {
  let origin = "";
  const server = createServer((request, response) => {
    void (async () => {
      const pathname = new URL(request.url ?? "/", origin || "http://127.0.0.1")
        .pathname;
      if (pathname === "/robots.txt") {
        response.writeHead(200, {
          "content-type": "text/plain",
          "x-content-type-options": "nosniff",
        });
        response.end(
          `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`,
        );
        return;
      }
      if (pathname === "/sitemap.xml") {
        const routes = [...routeFiles.keys()].filter(
          (route) => !route.endsWith(".svg"),
        );
        response.writeHead(200, {
          "content-type": "application/xml",
          "x-content-type-options": "nosniff",
        });
        response.end(
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((route) => `<url><loc>${origin}${route}</loc></url>`).join("")}</urlset>`,
        );
        return;
      }
      if (pathname === "/redirect-source") {
        response.writeHead(302, {
          location: "/redirect-target",
          "x-content-type-options": "nosniff",
        });
        response.end();
        return;
      }
      if (pathname === "/server-error") {
        response.writeHead(503, {
          "content-type": "text/html; charset=utf-8",
          "retry-after": "60",
          "x-content-type-options": "nosniff",
        });
        response.end(
          '<!doctype html><html lang="en"><title>Temporary benchmark failure</title><h1>Temporary failure</h1></html>',
        );
        return;
      }
      const file = routeFiles.get(pathname);
      if (!file) {
        response.writeHead(404, {
          "content-type": "text/html",
          "x-content-type-options": "nosniff",
        });
        response.end(
          "<!doctype html><title>Not found</title><h1>Not found</h1>",
        );
        return;
      }
      const source = await readFile(resolve(fixtureRoot, file), "utf8");
      const body = source
        .replaceAll("{{ORIGIN}}", origin)
        .replaceAll("{{COPY}}", longCopy(pathname));
      response.writeHead(200, {
        "content-type":
          extname(file) === ".svg"
            ? "image/svg+xml"
            : "text/html; charset=utf-8",
        "content-security-policy": "default-src 'self'",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
      });
      response.end(body);
    })().catch(() => {
      if (!response.headersSent)
        response.writeHead(500, { "content-type": "text/plain" });
      response.end("Fixture error");
    });
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveListen());
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture did not bind to a TCP port");
  origin = `http://127.0.0.1:${address.port}`;
  return { server, origin };
}

async function reservePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveListen());
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Unable to reserve a daemon port");
  const port = address.port;
  await new Promise<void>((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  );
  return port;
}

function redactBootstrap(value: string): string {
  return value.replace(/#token=[^\s]+/gu, "#token=[redacted]");
}

async function startDaemon(
  port: number,
  masterPasswordFile: string,
): Promise<{ process: ChildProcessWithoutNullStreams; url: string }> {
  const cli = resolve(repositoryRoot, "packages/cli/dist/cli.js");
  const environment = { ...process.env, NO_COLOR: "1" };
  delete environment.GOLEMSEO_ALLOW_PRIVATE;
  delete environment.SCREAMINGCLAW_ALLOW_PRIVATE;
  const child = spawn(
    process.execPath,
    [
      cli,
      "serve",
      "--port",
      String(port),
      "--data-dir",
      dataDirectory,
      "--master-password-file",
      masterPasswordFile,
    ],
    {
      cwd: repositoryRoot,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stdout = "";
  let stderr = "";
  const url = await new Promise<string>((resolveUrl, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `Timed out waiting for the Community dashboard.\n${redactBootstrap(stdout)}\n${stderr}`,
        ),
      );
    }, 30_000);
    const finish = (error?: Error, value?: string) => {
      clearTimeout(timer);
      if (error) reject(error);
      else resolveUrl(value!);
    };
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      const match = stdout.match(
        /^Dashboard:\s+(http:\/\/127\.0\.0\.1:\d+\/#token=[A-Za-z0-9_%=-]+)$/mu,
      );
      if (match?.[1]) finish(undefined, match[1]);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.once("exit", (code, signal) => {
      finish(
        new Error(
          `Community daemon exited before startup (${code ?? signal}).\n${redactBootstrap(stdout)}\n${stderr}`,
        ),
      );
    });
    child.once("error", (error) => finish(error));
  }).catch(async (error: unknown) => {
    await stopDaemon(child);
    throw error;
  });
  return { process: child, url };
}

async function stopDaemon(
  child: ChildProcessWithoutNullStreams | undefined,
): Promise<void> {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    once(child, "exit"),
    new Promise<void>((resolveTimeout) => setTimeout(resolveTimeout, 5_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
  if (child.exitCode === null) {
    await Promise.race([
      once(child, "exit"),
      new Promise<void>((resolveTimeout) => setTimeout(resolveTimeout, 2_000)),
    ]);
  }
}

async function runCliCommand(args: string[]): Promise<string> {
  const cli = resolve(repositoryRoot, "packages/cli/dist/cli.js");
  const port = new URL(dashboardUrl).port;
  const child = spawn(
    process.execPath,
    [cli, ...args, "--port", port, "--data-dir", dataDirectory],
    {
      cwd: repositoryRoot,
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });
  const exit = await Promise.race([
    once(child, "exit") as Promise<[number | null, NodeJS.Signals | null]>,
    new Promise<never>((_resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`CLI command timed out: ${args.join(" ")}`));
      }, 15_000);
      child.once("exit", () => clearTimeout(timeout));
    }),
  ]);
  const [code, signal] = exit;
  if (code !== 0) {
    throw new Error(
      `CLI command failed (${code ?? signal}): ${args.join(" ")}\n${stderr}`,
    );
  }
  return stdout;
}

test.beforeAll(async () => {
  dataDirectory = await mkdtemp(resolve(tmpdir(), "golem-seo-e2e-"));
  const masterPasswordFile = resolve(dataDirectory, "master-password");
  await writeFile(
    masterPasswordFile,
    `${randomBytes(32).toString("base64url")}\n`,
    { mode: 0o600 },
  );
  const fixture = await startFixture();
  fixtureServer = fixture.server;
  fixtureOrigin = fixture.origin;
  const daemonPort = await reservePort();
  const started = await startDaemon(daemonPort, masterPasswordFile);
  daemon = started.process;
  dashboardUrl = started.url;
});

test.afterAll(async () => {
  await stopDaemon(daemon);
  if (fixtureServer) {
    await new Promise<void>((resolveClose) =>
      fixtureServer!.close(() => resolveClose()),
    );
  }
  if (dataDirectory) await rm(dataDirectory, { recursive: true, force: true });
});

test("turns the one-time local bootstrap into a real audit and prioritized actions", async ({
  page,
  context,
}) => {
  expect(dashboardUrl).toMatch(
    /^http:\/\/127\.0\.0\.1:\d+\/#token=[A-Za-z0-9_-]{32,}$/u,
  );

  await page.goto(dashboardUrl, { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: "AGENTseo home" })).toBeVisible();
  await expect.poll(() => new URL(page.url()).hash).toBe("");
  await expectNoWcagViolations(page, "Empty local overview");

  const session = (await context.cookies()).find(
    (cookie) => cookie.name === "golem_session",
  );
  expect(session).toMatchObject({ httpOnly: true, sameSite: "Strict" });

  await page.getByRole("link", { name: /Setup guide/u }).click();
  await expect(
    page.getByRole("heading", { name: "Reach your first useful insight" }),
  ).toBeVisible();
  await expectNoWcagViolations(page, "Setup guide");
  await page.getByLabel("Workspace name").fill("Synthetic marketer site");
  await page.getByLabel("Canonical URL").fill(`${fixtureOrigin}/`);
  await page.getByRole("button", { name: "Add site" }).click();

  await expect(
    page.getByRole("heading", { name: "Synthetic marketer site" }),
  ).toBeVisible();
  await expectNoWcagViolations(page, "Goal selection");
  await page.getByRole("button", { name: /Improve technical health/u }).click();
  await page.getByText("Private-site access", { exact: true }).click();
  await page
    .getByLabel(/Allow this exact hostname to access a private network/u)
    .check();
  await page.getByRole("button", { name: "Run baseline audit" }).click();
  await expect(page.getByText("Audit queued", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "View audit history" }).click();
  const auditTable = page.getByRole("table", { name: "Audit runs" });
  await expect(auditTable).toBeVisible();
  await expect(
    auditTable.getByText(/queued|running|completed|partial/u).first(),
  ).toBeVisible();
  await expect(auditTable.getByText(/completed|partial/u).first()).toBeVisible({
    timeout: 90_000,
  });

  await auditTable.locator("tbody tr").first().getByRole("link").click();
  await expect(
    page.getByRole("heading", { level: 1, name: /^Run /u }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Run log" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sitemap coverage" }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Captured sitemap files" }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Crawl path evidence" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Redirects" }).click();
  await expect(
    page.getByRole("table", { name: "Redirect path evidence" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("link", { name: `${fixtureOrigin}/redirect-source` })
      .first(),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Hreflang" }).click();
  await expect(page.getByText("No hreflang captured")).toBeVisible();
  await expectNoWcagViolations(page, "Completed audit details");

  const sourceRunHeading = await page
    .getByRole("heading", { level: 1, name: /^Run /u })
    .innerText();
  await page.getByRole("button", { name: "Replay configuration" }).click();
  await expect(page.getByText("Independent replay queued")).toBeVisible();
  await expect(page.getByText(/It never edits this result/u)).toBeVisible();
  await page.getByRole("link", { name: "Open replay" }).click();
  await expect
    .poll(() =>
      page.getByRole("heading", { level: 1, name: /^Run /u }).innerText(),
    )
    .not.toBe(sourceRunHeading);
  await expect(page.getByText("run.replay_queued")).toBeVisible();
  await expect(
    page
      .locator(".detail-summary-grid")
      .getByText(/completed|partial/u)
      .first(),
  ).toBeVisible({ timeout: 90_000 });
  await expect(
    page.getByRole("heading", { name: "Sitemap coverage" }),
  ).toBeVisible();
  await expectNoWcagViolations(page, "Replayed audit details");

  await page.getByRole("link", { name: "Audits", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Compare audit runs" }),
  ).toBeVisible();
  await expect(page.getByLabel("Baseline audit")).toBeVisible();
  await expect(page.getByLabel("Current audit")).toBeVisible();
  await expect(page.getByText("Comparable", { exact: true })).toBeVisible();
  await expect(
    page.getByText("No new or worsened effective issues were detected."),
  ).toBeVisible();
  await expect(
    page.getByText("Stored crawl settings match across both snapshots."),
  ).toBeVisible();
  await expectNoWcagViolations(page, "Audit comparison workbench");
  await page.screenshot({
    path: "output/playwright/audit-comparison-workbench.png",
    fullPage: true,
  });

  await page.getByRole("link", { name: "Pages", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Pages" }),
  ).toBeVisible();
  const pagesTable = page.getByRole("table", { name: "Crawled pages" });
  await expect(pagesTable).toBeVisible();
  const rootPageRow = pagesTable
    .locator("tbody tr")
    .filter({ hasText: "Golem SEO synthetic benchmark" });
  await expect(rootPageRow).toHaveCount(1);
  await rootPageRow
    .getByRole("button", {
      name: "Explore internal links for Golem SEO synthetic benchmark",
    })
    .click();
  await expect(
    page.getByRole("region", {
      name: "Internal links for Golem SEO synthetic benchmark",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Outlinks ·/u }).click();
  const outlinksTable = page.getByRole("table", {
    name: "outlinks for Golem SEO synthetic benchmark",
  });
  await expect(outlinksTable).toBeVisible();
  await expect(
    outlinksTable.getByText("Redirecting destination"),
  ).toBeVisible();
  await expect(outlinksTable.getByText("Broken destination")).toBeVisible();
  await expect(
    outlinksTable.getByText("redirected", { exact: true }),
  ).toBeVisible();
  await expect(
    outlinksTable.getByText("broken", { exact: true }).first(),
  ).toBeVisible();
  await expectNoWcagViolations(page, "Internal-link explorer");
  await page.screenshot({
    path: "output/playwright/internal-link-explorer.png",
    fullPage: true,
  });

  await page.getByRole("link", { name: "Actions", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Actions", exact: true }),
  ).toBeVisible();
  const actionsTable = page.getByRole("table", {
    name: "Prioritized SEO actions",
  });
  await expect(actionsTable).toBeVisible();
  await expect(actionsTable.locator("tbody tr").first()).toBeVisible();
  const initialActionCount = await actionsTable.locator("tbody tr").count();
  expect(initialActionCount).toBeGreaterThan(0);
  let reviewedIssueTitle = "";
  let reviewedGroupSize = 0;
  for (let index = 0; index < initialActionCount; index += 1) {
    const row = actionsTable.locator("tbody tr").nth(index);
    const scope = Number(
      (await row.locator("td").nth(2).locator("strong").innerText()).trim(),
    );
    if (scope !== 2) continue;
    reviewedIssueTitle = (
      await row.locator("td").nth(1).getByRole("link").innerText()
    ).trim();
    reviewedGroupSize = scope;
    break;
  }
  expect(reviewedIssueTitle).not.toBe("");
  expect(reviewedGroupSize).toBe(2);
  await expect(
    page.getByRole("combobox", { name: /Workflow status for/u }).first(),
  ).toBeVisible();
  await expectNoWcagViolations(page, "Prioritized actions");

  const statusControl = page
    .getByRole("combobox", { name: /Workflow status for/u })
    .first();
  const statusLabel = await statusControl.getAttribute("aria-label");
  expect(statusLabel).toBeTruthy();
  await statusControl.selectOption("in_progress");
  await expect(statusControl).toHaveValue("in_progress");
  await expect(page.getByText("Saving…", { exact: true }).first()).toBeHidden();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("combobox", { name: statusLabel! })).toHaveValue(
    "in_progress",
  );

  await page
    .getByRole("link", { name: "Project context", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Project context" }),
  ).toBeVisible();
  await page
    .getByLabel("Business and search summary")
    .fill(
      "Help hands-on SEO teams turn crawl evidence into verified improvements.",
    );
  await page.getByLabel("Priority audiences").fill("SEO leads\nGrowth teams");
  await page.getByLabel("Markets").fill("United States\nUnited Kingdom");
  await page.getByLabel("Languages").fill("English");
  await page.getByLabel("Conversion goals").fill("Qualified demo request");
  await page
    .getByLabel("Priority topics")
    .fill("Technical SEO automation\nEvidence-led reporting");
  await page.getByLabel("Known competitors").fill("example-competitor.com");
  await page
    .getByLabel("Constraints and guardrails")
    .fill("Require verification before publishing impact claims");
  await page
    .getByLabel("Revision summary")
    .fill("Established the shared SEO operating brief");
  await page.getByRole("button", { name: "Save new revision" }).click();
  await expect(page.getByText("Context revision saved")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Revision 1" }),
  ).toBeVisible();

  await page.getByLabel("Entry type").selectOption("decision");
  await page.getByLabel("Source audit (optional)").selectOption({ index: 1 });
  await page
    .getByLabel("Entry title")
    .fill("Prioritize verification before growth claims");
  await page
    .getByLabel("Evidence and implication")
    .fill(
      "Every reported improvement must cite a baseline and a repeat audit.",
    );
  await page.getByRole("button", { name: "Append journal entry" }).click();
  await expect(page.getByText("Journal entry appended")).toBeVisible();
  await expect(
    page.getByText("Prioritize verification before growth claims"),
  ).toBeVisible();
  await expectNoWcagViolations(page, "Versioned Project Context");
  await page.reload({ waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { level: 2, name: "Revision 1" }),
  ).toBeVisible();
  await expect(
    page.getByText("Prioritize verification before growth claims"),
  ).toBeVisible();

  await page.getByRole("link", { name: "Issue review", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Issue review" }),
  ).toBeVisible();
  const issuesTable = page.getByRole("table", {
    name: "SEO issues awaiting or carrying review decisions",
  });
  await expect(issuesTable.locator("tbody tr").first()).toBeVisible();
  const reviewedGroupRows = issuesTable
    .locator("tbody tr")
    .filter({ hasText: reviewedIssueTitle });
  await expect(reviewedGroupRows).toHaveCount(reviewedGroupSize);
  const issueRow = reviewedGroupRows.first();
  await issueRow.getByRole("button", { name: "Review" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: reviewedIssueTitle }),
  ).toBeVisible();
  await expect(
    page.getByText("Raw audit evidence and history are never deleted."),
  ).toBeVisible();
  await expectNoWcagViolations(page, "Issue evidence review");

  const saveReview = page.getByRole("button", { name: "Save review" });
  await page.getByLabel("Mark false positive", { exact: false }).check();
  await page
    .getByLabel("Review reason (required)")
    .fill("The benchmark fixture intentionally contains this known pattern.");
  await expect(saveReview).toBeDisabled();
  await page
    .getByLabel(/I reviewed the evidence\. Keep this classification/u)
    .check();
  await expect(saveReview).toBeEnabled();
  await saveReview.click();
  await expect(
    issuesTable.locator("tbody tr").filter({ hasText: reviewedIssueTitle }),
  ).toHaveCount(reviewedGroupSize - 1);

  await page.reload({ waitUntil: "networkidle" });
  await page.getByLabel("Status").selectOption("false_positive");
  const falsePositiveIssueRow = page
    .getByRole("table", {
      name: "SEO issues awaiting or carrying review decisions",
    })
    .locator("tbody tr")
    .filter({ hasText: reviewedIssueTitle });
  await expect(falsePositiveIssueRow).toHaveCount(1);
  await expect(falsePositiveIssueRow.getByText("false positive")).toBeVisible();
  await expectNoWcagViolations(page, "Persisted issue classification");

  await page.getByRole("link", { name: "Actions", exact: true }).click();
  const partiallyReviewedActions = page.getByRole("table", {
    name: "Prioritized SEO actions",
  });
  await expect(partiallyReviewedActions.locator("tbody tr")).toHaveCount(
    initialActionCount,
  );
  const narrowedActionRow = partiallyReviewedActions
    .locator("tbody tr")
    .filter({ has: page.getByRole("link", { name: reviewedIssueTitle }) });
  await expect(narrowedActionRow).toHaveCount(1);
  await expect(
    narrowedActionRow.locator("td").nth(2).locator("strong"),
  ).toHaveText(String(reviewedGroupSize - 1));

  await page.getByRole("link", { name: "Issue review", exact: true }).click();
  const remainingGroupRow = page
    .getByRole("table", {
      name: "SEO issues awaiting or carrying review decisions",
    })
    .locator("tbody tr")
    .filter({ hasText: reviewedIssueTitle });
  await expect(remainingGroupRow).toHaveCount(1);
  await remainingGroupRow.getByRole("button", { name: "Review" }).click();
  await page.getByLabel("Ignore intentionally", { exact: false }).check();
  await page
    .getByLabel("Review reason (required)")
    .fill("This benchmark page is intentionally concise for its single goal.");
  await page
    .getByLabel(/I reviewed the evidence\. Keep this classification/u)
    .check();
  await page.getByRole("button", { name: "Save review" }).click();
  await expect(
    page
      .getByRole("table", {
        name: "SEO issues awaiting or carrying review decisions",
      })
      .locator("tbody tr")
      .filter({ hasText: reviewedIssueTitle }),
  ).toHaveCount(0);

  await page.reload({ waitUntil: "networkidle" });
  await page.getByLabel("Status").selectOption("ignored");
  await expect(
    page
      .getByRole("table", {
        name: "SEO issues awaiting or carrying review decisions",
      })
      .locator("tbody tr")
      .filter({ hasText: reviewedIssueTitle }),
  ).toHaveCount(1);

  await page.getByRole("link", { name: "Actions", exact: true }).click();
  const fullyReviewedActions = page.getByRole("table", {
    name: "Prioritized SEO actions",
  });
  await expect(fullyReviewedActions.locator("tbody tr")).toHaveCount(
    initialActionCount - 1,
  );
  await expect(
    fullyReviewedActions.getByRole("link", {
      name: reviewedIssueTitle,
      exact: true,
    }),
  ).toHaveCount(0);

  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Reports" }),
  ).toBeVisible();
  const reportDownloads = page
    .getByRole("group", { name: /^Download SEO audit/u })
    .first();
  await expect(reportDownloads).toBeVisible();
  const reportMediaTypes = {
    HTML: "text/html",
    PDF: "application/pdf",
    CSV: "text/csv",
    JSON: "application/json",
  } as const;
  for (const [format, mediaType] of Object.entries(reportMediaTypes)) {
    const link = reportDownloads.getByRole("link", {
      name: new RegExp(`^Download ${format} report:`, "u"),
    });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toBeTruthy();
    const response = await page.request.get(href!);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain(mediaType);
    expect(response.headers()["content-disposition"]).toMatch(
      new RegExp(`\\.${format.toLowerCase()}\"$`, "u"),
    );
    expect((await response.body()).byteLength).toBeGreaterThan(20);
  }
  await expectNoWcagViolations(page, "Reports");

  await page.getByRole("link", { name: "Integrations", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Integrations" }),
  ).toBeVisible();
  await expectNoWcagViolations(page, "Integration catalog");

  const serpApiCard = page.locator(".integration-card").filter({
    has: page.getByRole("heading", { name: "SerpAPI", exact: true }),
  });
  await serpApiCard.getByRole("button", { name: "Configure site" }).click();
  await serpApiCard
    .getByLabel("Default location")
    .fill("Austin, Texas, United States");
  await serpApiCard.getByRole("button", { name: "Save configuration" }).click();
  await expect(
    serpApiCard.getByRole("button", { name: "Edit site mapping" }),
  ).toBeVisible();

  await serpApiCard.getByRole("button", { name: "Connect API key" }).click();
  await serpApiCard
    .getByLabel("API key")
    .fill("e2e-local-credential-to-delete");
  await expectNoWcagViolations(page, "Write-only integration credential form");
  await serpApiCard.getByRole("button", { name: "Save and connect" }).click();
  await expect(
    serpApiCard.getByText("degraded", { exact: true }),
  ).toBeVisible();

  await serpApiCard
    .getByRole("button", { name: "Revoke SerpAPI local access" })
    .click();
  await expect(
    serpApiCard.getByText(/cannot deactivate an API key or OAuth grant/u),
  ).toBeVisible();
  const removeCredential = serpApiCard.getByRole("button", {
    name: "Remove local credential",
  });
  await expect(removeCredential).toBeDisabled();
  await serpApiCard
    .getByRole("checkbox", {
      name: /disconnects SerpAPI across every local project/u,
    })
    .check();
  await expectNoWcagViolations(page, "Integration credential removal");
  await removeCredential.click();
  await expect(page.getByText("Local credential removed")).toBeVisible();
  await expect(
    serpApiCard.getByText("not configured", { exact: true }),
  ).toBeVisible();
  await expect(
    serpApiCard.getByRole("button", { name: "Edit site mapping" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings" }),
  ).toBeVisible();
  await expectNoWcagViolations(page, "Project settings");

  const cliTemplates = JSON.parse(
    await runCliCommand(["extraction", "templates"]),
  ) as { version?: string; importMode?: string; templates?: unknown[] };
  expect(cliTemplates).toMatchObject({
    version: "extraction-template-catalog-v1",
    importMode: "review_required",
  });
  expect(cliTemplates.templates).toHaveLength(4);

  await page
    .getByRole("button", { name: "Review Social preview metadata" })
    .click();
  const templateReview = page.getByRole("table", {
    name: "Social preview metadata fields",
  });
  await expect(templateReview).toBeVisible();
  await expect(templateReview.getByText("Open Graph title")).toBeVisible();
  await expect(page.getByText("Assumptions to verify")).toBeVisible();
  await expectNoWcagViolations(page, "Extraction template review");
  await page.screenshot({
    path: resolve(
      repositoryRoot,
      "output/playwright/extraction-template-review.png",
    ),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Add 4 fields to draft" }).click();
  await expect(page.getByText("Template added to draft")).toBeVisible();

  await page.getByRole("button", { name: "Add rule" }).click();
  await page.getByLabel("Field label").last().fill("Primary heading");
  await page.getByLabel("CSS selector").last().fill("h1");
  await page.getByLabel(/Allow this exact private host/u).check();
  await page.getByRole("button", { name: "Preview draft" }).click();
  const previewTable = page.getByRole("table", {
    name: "Extraction preview results",
  });
  await expect(previewTable).toBeVisible();
  await expect(previewTable.getByText("Primary heading")).toBeVisible();
  await expect(previewTable.getByText("SEO benchmark index")).toBeVisible();
  await expect(previewTable.getByText("Open Graph title")).toBeVisible();
  await expect(
    previewTable.getByText("Golem SEO benchmark preview"),
  ).toBeVisible();
  await page
    .getByLabel("Revision summary")
    .fill("Capture social previews and the primary page heading");
  await page.getByRole("button", { name: "Save revision" }).click();
  await expect(page.getByText("Rule revision saved")).toBeVisible();
  await expect(page.getByLabel("Current rule set")).toContainText("Revision 1");
  await expectNoWcagViolations(page, "Extraction preview and saved revision");

  await page.getByRole("link", { name: "Audits", exact: true }).click();
  await page.getByText("Private-site access", { exact: true }).click();
  await page
    .getByLabel(/Allow this exact hostname to access a private network/u)
    .check();
  await page.getByRole("button", { name: "Run full audit" }).click();
  await expect(page.getByText("Audit queued", { exact: true })).toBeVisible();
  const extractionAuditTable = page.getByRole("table", {
    name: "Audit runs",
  });
  await expect(
    extractionAuditTable.getByText(/completed|partial/u).first(),
  ).toBeVisible({ timeout: 90_000 });
  await extractionAuditTable
    .locator("tbody tr")
    .first()
    .getByRole("link")
    .click();
  await page.getByRole("tab", { name: "Extractions" }).click();
  const extractionEvidence = page.getByRole("table", {
    name: "Custom extraction evidence",
  });
  await expect(extractionEvidence).toBeVisible();
  await expect(
    extractionEvidence.getByText("Primary heading").first(),
  ).toBeVisible();
  await expect(
    extractionEvidence.getByText("SEO benchmark index").first(),
  ).toBeVisible();
  await expect(
    extractionEvidence.getByText("Golem SEO benchmark preview").first(),
  ).toBeVisible();
  await expectNoWcagViolations(page, "Captured extraction evidence");

  await page.getByRole("link", { name: "Settings", exact: true }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export project" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.golemseo$/u);
  const bundlePath = await download.path();
  expect(bundlePath).toBeTruthy();
  const bundleBuffer = await readFile(bundlePath!);
  const bundle = JSON.parse(bundleBuffer.toString("utf8")) as {
    runs?: Array<{ id?: string }>;
    runConfigurations?: Array<{
      runId?: string;
      options?: { extractionRuleRevision?: number | null };
    }>;
    issueAdjudications?: Array<{ status?: string; note?: string }>;
    projectContext?: {
      versions?: Array<{
        revision?: number;
        changeSummary?: string;
        profile?: { markets?: string[] };
      }>;
      journal?: Array<{
        sequence?: number;
        title?: string;
        sourceRunId?: string | null;
      }>;
    };
    extractionRuleVersions?: Array<{
      revision?: number;
      rules?: Array<{ id?: string; label?: string; selector?: string }>;
    }>;
  };
  expect(bundle.issueAdjudications).toContainEqual(
    expect.objectContaining({
      status: "false_positive",
      note: "The benchmark fixture intentionally contains this known pattern.",
    }),
  );
  expect(bundle.issueAdjudications).toContainEqual(
    expect.objectContaining({
      status: "ignored",
      note: "This benchmark page is intentionally concise for its single goal.",
    }),
  );
  expect(bundle.projectContext?.versions).toContainEqual(
    expect.objectContaining({
      revision: 1,
      changeSummary: "Established the shared SEO operating brief",
      profile: expect.objectContaining({
        markets: ["United States", "United Kingdom"],
      }),
    }),
  );
  expect(bundle.projectContext?.journal).toContainEqual(
    expect.objectContaining({
      sequence: 1,
      title: "Prioritize verification before growth claims",
      sourceRunId: expect.any(String),
    }),
  );
  expect(bundle.extractionRuleVersions).toContainEqual(
    expect.objectContaining({
      revision: 1,
      rules: expect.arrayContaining([
        expect.objectContaining({
          label: "Open Graph title",
          selector: "meta[property='og:title']",
        }),
        expect.objectContaining({
          label: "Primary heading",
          selector: "h1",
        }),
      ]),
    }),
  );
  expect(bundle.runConfigurations).toHaveLength(bundle.runs?.length ?? 0);
  expect(bundle.runConfigurations).toContainEqual(
    expect.objectContaining({
      options: expect.objectContaining({ extractionRuleRevision: 1 }),
    }),
  );
  await page.locator("#project-import-file").setInputFiles({
    name: download.suggestedFilename(),
    mimeType: "application/vnd.golemseo.project+json",
    buffer: bundleBuffer,
  });
  await expect(page.getByText("Project imported", { exact: true })).toBeVisible(
    {
      timeout: 30_000,
    },
  );
  await expectNoWcagViolations(page, "Imported project confirmation");

  await page
    .getByRole("link", { name: "Project context", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Revision 1" }),
  ).toBeVisible();
  await expect(
    page.getByText("Prioritize verification before growth claims"),
  ).toBeVisible();
  await expectNoWcagViolations(page, "Imported Project Context");

  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Current rule set")).toContainText("Revision 1");
  await expectNoWcagViolations(page, "Imported extraction rules");

  await page.getByRole("link", { name: "System health", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "System health" }),
  ).toBeVisible();
  await expectNoWcagViolations(page, "System health");

  await page.setViewportSize({ width: 390, height: 844 });
  const openNavigation = page.getByRole("button", { name: "Open navigation" });
  await expect(openNavigation).toBeVisible();
  await openNavigation.click();
  await expect(
    page.getByRole("dialog", { name: "Main navigation" }),
  ).toBeVisible();
  await expectNoWcagViolations(page, "Mobile navigation dialog");
  await page.keyboard.press("Escape");
  await expect(openNavigation).toBeFocused();

  await page.setViewportSize({ width: 1440, height: 960 });
  const siteSelector = page.getByLabel("Active site");
  await expect(siteSelector.locator("option")).toHaveCount(2);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Delete project" }).click();
  const deletionConfirmation = page.getByLabel(
    "Type the project name to confirm",
  );
  const permanentDeletion = page.getByRole("button", {
    name: "Permanently delete project",
  });
  await expect(permanentDeletion).toBeDisabled();
  await deletionConfirmation.fill("Synthetic marketer site");
  await expect(permanentDeletion).toBeEnabled();
  await expectNoWcagViolations(page, "Confirmed project deletion");
  await permanentDeletion.click();
  await expect(page.getByText("Local project deleted")).toBeVisible();
  await expect(siteSelector.locator("option")).toHaveCount(1);
  await expectNoWcagViolations(page, "Project deletion receipt");

  await page
    .getByRole("link", { name: "Project context", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Revision 1" }),
  ).toBeVisible();
  await expect(
    page.getByText("Prioritize verification before growth claims"),
  ).toBeVisible();
});
