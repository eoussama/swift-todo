import { resolve } from "node:path";

import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";



export default defineConfig({
  root: resolve(import.meta.dirname, ".."),
  // WxtVitest sets up the fake browser and aliases; svelte() compiles runes in `.svelte.ts` files.
  plugins: [WxtVitest(), svelte()],
  // The browser build of Svelte, so effects run in tests (with a DOM environment) as they do in the popup.
  resolve: { conditions: ["browser"] },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["tests/unit/setup.ts"],
    passWithNoTests: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      // Every line, branch and function of the logic is tested.
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
