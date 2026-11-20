import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";



export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    include: ["tests/unit/**/*.test.ts"],
    passWithNoTests: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
    },
  },
});
