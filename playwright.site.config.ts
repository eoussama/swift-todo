import process from "node:process";

import { defineConfig } from "@playwright/test";



const ci = process.env.CI !== undefined;
const PORT = 4321;

/**
 * Tests the website as built (`.output/site`), served by `vite preview`.
 * `pnpm test:site` builds it first.
 */
export default defineConfig({
  testDir: "tests/site",
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm exec vite preview --config site/vite.config.ts --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !ci,
  },
});
