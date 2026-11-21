// Mutation testing for the logic in src/lib: `pnpm test:mutation`.
// It runs on its own, outside `pnpm check` and CI, since it takes a while.
/** @type {import("@stryker-mutator/api/core").PartialStrykerOptions} */
export default {
  testRunner: "vitest",
  vitest: { configFile: "config/vitest.stryker.config.ts" },
  plugins: ["@stryker-mutator/vitest-runner"],
  mutate: ["src/lib/**/*.ts", "!src/lib/components/**"],
  checkers: [],
  coverageAnalysis: "perTest",
  reporters: ["html", "clear-text", "progress", "json"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  thresholds: { high: 100, low: 95, break: null },
  concurrency: 6,
  timeoutMS: 20000,
  tempDirName: ".stryker-tmp",
  cleanTempDir: "always",
};
