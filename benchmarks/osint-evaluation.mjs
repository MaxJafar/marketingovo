import { evaluateOsintFixtures } from "./osint-fixture-runner.mjs";

const report = await evaluateOsintFixtures();
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
