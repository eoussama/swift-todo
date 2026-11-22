import type { Plugin } from "vite";

import { mkdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import { svelte } from "@sveltejs/vite-plugin-svelte";
import sharp from "sharp";
import { defineConfig } from "vite";



const ROOT = import.meta.dirname;
const REPO = resolve(ROOT, "..");
const { version } = JSON.parse(readFileSync(resolve(REPO, "package.json"), "utf8")) as { version: string };

/** Each browser's store page, or `""` while it isn't live. */
const stores = JSON.parse(readFileSync(resolve(ROOT, "stores.json"), "utf8")) as Record<"chrome" | "edge" | "firefox", string>;

/**
 * Lists the live store pages in the page's structured data, so search
 * engines get the same links as the buttons.
 *
 * @returns The Vite plugin.
 */
function installUrls(): Plugin {
  return {
    name: "swift-todo:install-urls",
    transformIndexHtml(html) {
      return html.replace("\"%INSTALL_URLS%\"", JSON.stringify(Object.values(stores).filter(url => url !== "")));
    },
  };
}

/**
 * Serves a PNG imported with `?webp` as a lossless WebP: the same pixels, in
 * about 40% fewer bytes. The showcase PNGs stay as they are for the README and
 * the stores; the site converts them as it builds, keeping each file's name
 * ("skin-chalk-dark.webp"), and reuses a conversion until its PNG changes.
 *
 * @returns The Vite plugin.
 */
function webp(): Plugin {
  const cache = resolve(REPO, "node_modules/.cache/site-webp");
  const converting = new Map<string, Promise<void>>();

  async function convert(png: string, out: string): Promise<void> {
    const fresh = (() => {
      try {
        return statSync(out).mtimeMs >= statSync(png).mtimeMs;
      }
      catch {
        return false;
      }
    })();

    if (!fresh) {
      mkdirSync(cache, { recursive: true });
      await sharp(png).webp({ lossless: true, effort: 6 }).toFile(out);
    }
  }

  return {
    name: "swift-todo:webp",
    enforce: "pre",
    resolveId(source, importer) {
      return source.endsWith(".png?webp") && importer !== undefined ? `${resolve(dirname(importer), source.slice(0, -"?webp".length))}?webp` : null;
    },
    async load(id) {
      if (!id.endsWith(".png?webp")) {
        return null;
      }

      const png = id.slice(0, -"?webp".length);
      const out = resolve(cache, `${basename(png, ".png")}.webp`);

      this.addWatchFile(png);

      // One conversion per file, even when several components import it at once.
      if (!converting.has(out)) {
        converting.set(out, convert(png, out).finally(() => converting.delete(out)));
      }

      await converting.get(out);

      return `export { default } from ${JSON.stringify(out)};`;
    },
  };
}

/**
 * The website at swift-todo.ouss.es. `pnpm site` serves it with hot reload;
 * `pnpm site:build` builds it into `.output/site`, with the page rendered to
 * HTML (see `build.ts`).
 */
export default defineConfig({
  root: ROOT,
  base: "/",
  define: { __VERSION__: JSON.stringify(version), __STORES__: JSON.stringify(stores) },
  plugins: [webp(), installUrls(), svelte({ configFile: resolve(REPO, "svelte.config.js") })],
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
