import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const source = resolve(root, "apps/dashboard/dist");
const destination = resolve(root, "packages/cli/dashboard");
if (!existsSync(source))
  throw new Error(
    "Dashboard build is missing. Build @agentseoapp/dashboard before agentseo.",
  );
rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
cpSync(source, destination, { recursive: true });
