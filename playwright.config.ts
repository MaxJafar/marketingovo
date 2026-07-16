import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  outputDir: "output/playwright/test-results",
  reporter: process.env.CI
    ? [
        ["line"],
        ["html", { outputFolder: "output/playwright/report", open: "never" }],
      ]
    : [["line"]],
  use: {
    ...devices["Desktop Chrome"],
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
});
