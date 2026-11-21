import process from "node:process";

import { defineConfig } from "@playwright/test";



const ci = process.env.CI !== undefined;

/**
 * End-to-end tests run the built Chrome extension (`.output/chrome-mv3`) in
 * Chromium; `pnpm test:e2e` builds it first. Playwright can't load extensions
 * in Firefox, which is covered by its build and Mozilla's add-on linter.
 */
export default defineConfig({
  testDir: "../tests/e2e",
  // Results and reports stay at the project root, where CI collects them.
  outputDir: "../test-results",
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [["github"], ["html", { open: "never", outputFolder: "../playwright-report" }]] : "list",
  use: {
    trace: "retain-on-failure",
  },
});
