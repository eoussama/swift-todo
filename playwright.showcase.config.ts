import { defineConfig } from "@playwright/test";



/**
 * Takes the screenshots in `showcase/` from the built Chrome extension.
 * `pnpm showcase` builds it first. Not part of `pnpm check`, since it rewrites
 * the images.
 */
export default defineConfig({
  testDir: "tests/showcase",
  fullyParallel: true,
  reporter: "list",
  use: {
    deviceScaleFactor: 2,
    // Animations and color transitions finish at once, so no shot catches one halfway.
    contextOptions: { reducedMotion: "reduce" },
  },
});
