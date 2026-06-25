import { defineConfig } from "@playwright/test";

/**
 * Playwright + Electron E2E configuration.
 *
 * - Tests live in `e2e/tests` and drive the built Electron app (run
 *   `npm run build:e2e` first; `pretest:e2e` does this automatically).
 * - AI is mocked by default (offline, deterministic). `npm run test:e2e:real`
 *   sets E2E_REAL_AI=1 for an opt-in real-API run.
 * - Reports land in `test-reports/` (gitignored) so results are documentable.
 */
export default defineConfig({
  testDir: "./e2e/tests",
  globalSetup: "./e2e/global-setup.ts",

  // Electron launches are heavy and share a single binary; keep runs serial.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  timeout: 120_000,
  expect: { timeout: 15_000 },

  outputDir: "test-results",

  reporter: [
    ["list"],
    ["html", { outputFolder: "test-reports/playwright-html", open: "never" }],
    ["json", { outputFile: "test-reports/e2e-results.json" }],
    ["junit", { outputFile: "test-reports/e2e-junit.xml" }],
  ],

  // These also surface in the per-launch manual capture in electronApp.ts.
  use: {
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
});
