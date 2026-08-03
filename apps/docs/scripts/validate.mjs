import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const workspaceRoot = resolve(root, "../..");
const canonicalPrefix = "https://github.com/MaxJafar/marketingovo/blob/main/";
const requiredPages = [
  "site/index.md",
  "site/getting-started/overview.md",
  "site/getting-started/quickstart.md",
  "site/workflows/marketer-workflows.md",
  "site/product/dashboard-actions.md",
  "site/product/project-context.md",
  "site/integrations/byok.md",
  "site/agents/rest-api.md",
  "site/agents/agent-surfaces.md",
  "site/trust/security-privacy.md",
  "site/community/contributing.md",
  "site/product/release-status.md",
];

for (const page of requiredPages) {
  const content = await readFile(resolve(root, page), "utf8");
  if (!content.includes(canonicalPrefix)) {
    throw new Error(`${page} must link to a canonical repository document`);
  }

  const canonicalLinks = content.matchAll(
    new RegExp(
      `${canonicalPrefix.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}([^\\s"')>]+)`,
      "gu",
    ),
  );
  for (const link of canonicalLinks) {
    const repositoryPath = decodeURIComponent(link[1]);
    await access(resolve(workspaceRoot, repositoryPath));
  }
}

process.stdout.write(
  `Validated ${requiredPages.length} documentation pages.\n`,
);
