// A stray nested copy of this repository once sat at AGENTintel/AGENTintel as an
// orphaned git worktree: 705 MB, untracked, byte-identical to its parent, and
// invisible to `git status` beyond a single line. It shadowed searches and
// inflated the tree. This gate fails if one reappears.

import { readdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const MARKERS = ["go.mod", "package.json", "pnpm-workspace.yaml"];

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function describeGitDir(directory) {
  const gitPath = resolve(directory, ".git");
  if (!(await exists(gitPath))) return null;
  const info = await stat(gitPath);
  if (info.isDirectory()) return "a nested git repository";
  const pointer = (await readFile(gitPath, "utf8")).trim();
  const target = pointer.replace(/^gitdir:\s*/u, "");
  const live = await exists(target);
  return live
    ? `a git worktree of ${target}`
    : `an orphaned git worktree; its backing gitdir ${target} no longer exists`;
}

const failures = [];

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

  const directory = resolve(root, entry.name);
  const present = await Promise.all(
    MARKERS.map((marker) => exists(resolve(directory, marker))),
  );
  if (!present.every(Boolean)) continue;

  const git = await describeGitDir(directory);
  failures.push(
    `${entry.name}/ looks like a full checkout of this repository` +
      (git ? ` (${git})` : "") +
      ". Remove it; a nested copy shadows searches and inflates the tree.",
  );
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write("No nested repository checkout found.\n");
