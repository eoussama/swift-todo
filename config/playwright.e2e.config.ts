import process from "node:process";

import { defineConfig } from "@playwright/test";



const ci = process.env.CI !== undefined;

// One time zone everywhere, on every machine: the tests (here, in Node), the
// popup and the extension's worker. Half an hour off UTC and without daylight
// saving, so a mix-up between local and UTC dates shows, and always the same way.
const TIME_ZONE = "Asia/Kolkata";

process.env.TZ = TIME_ZONE;

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
    // Dates and times read the same on every machine ("Tomorrow 3:00 PM").
    locale: "en-US",
    timezoneId: TIME_ZONE,
    trace: "retain-on-failure",
  },
});
