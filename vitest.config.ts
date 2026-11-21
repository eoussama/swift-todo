import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";



export default defineConfig({
  // WxtVitest sets up the fake browser and aliases; svelte() compiles runes in `.svelte.ts` files.
  plugins: [WxtVitest(), svelte()],
  test: {
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["tests/unit/setup.ts"],
    passWithNoTests: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 85,
      },
    },
  },
});
