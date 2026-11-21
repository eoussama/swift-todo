import { defineConfig } from "@playwright/test";



/**
 * Renders the store images in `branding/` from the icon and the showcase
 * screenshots. Not part of `pnpm check`, since it rewrites the images.
 */
export default defineConfig({
  testDir: "../tests/branding",
  outputDir: "../test-results",
  fullyParallel: true,
  reporter: "list",
  use: {
    // One CSS pixel per image pixel, so each image comes out at the store's exact size.
    deviceScaleFactor: 1,
  },
});
