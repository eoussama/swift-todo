import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";



const ROOT = import.meta.dirname;
const REPO = resolve(ROOT, "..");
const { version } = JSON.parse(readFileSync(resolve(REPO, "package.json"), "utf8")) as { version: string };

/**
 * The website at swift-todo.ouss.es. `pnpm site` serves it with hot reload;
 * `pnpm site:build` builds it into `.output/site`, with the page rendered to
 * HTML (see `build.ts`).
 */
export default defineConfig({
  root: ROOT,
  base: "/",
  define: { __VERSION__: JSON.stringify(version) },
  plugins: [svelte({ configFile: resolve(REPO, "svelte.config.js") })],
  resolve: {
    alias: {
      // The extension's date parser and formatter, with the few strings they need.
      "#i18n": resolve(ROOT, "src/i18n.ts"),
      "@": resolve(REPO, "src"),
    },
  },
  build: {
    outDir: resolve(REPO, ".output/site"),
    emptyOutDir: true,
    // Fonts and images stay files, so the page's CSP needs no data: URLs.
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        home: resolve(ROOT, "index.html"),
        privacy: resolve(ROOT, "privacy/index.html"),
      },
    },
  },
  server: {
    fs: { allow: [REPO] },
  },
});
