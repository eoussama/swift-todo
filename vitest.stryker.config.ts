import { env } from "node:process";

import { mergeConfig } from "vitest/config";

import base from "./vitest.config";



// Stryker runs several Vitest workers at once; each worker of each run (named
// by STRYKER_RUN) gets its own Vite cache, or they trip over each other's files
// (EPERM on Windows).
export default mergeConfig(base, {
  cacheDir: `node_modules/.vite-stryker/${env.STRYKER_RUN ?? "run"}-${env.STRYKER_MUTATOR_WORKER ?? "main"}`,
});
