import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { build } from "vite";



// Builds the website: the browser bundle, then the page rendered to HTML with
// the same components, so it reads fine before (or without) JavaScript.

const ROOT = import.meta.dirname;
const OUT = resolve(ROOT, "../.output/site");
const SSR_OUT = resolve(ROOT, "../.output/site-ssr");
const configFile = resolve(ROOT, "vite.config.ts");

/**
 * Builds both bundles, renders each page into its HTML, and removes the server bundle.
 *
 * @returns Once the site is in `.output/site`.
 */
async function main(): Promise<void> {
  await build({ configFile, logLevel: "warn" });
  await build({ configFile, logLevel: "warn", build: { ssr: resolve(ROOT, "src/render.ts"), outDir: SSR_OUT, emptyOutDir: true } });

  const { render } = await import(pathToFileURL(resolve(SSR_OUT, "render.js")).href) as { render: (page: string) => { head: string; body: string } };

  for (const file of ["index.html", "privacy/index.html"]) {
    const { head, body } = render(file);
    const page = resolve(OUT, file);
    const html = await readFile(page, "utf8");

    if (!html.includes("<!--app-->")) {
      throw new Error(`${file} has no <!--app--> placeholder.`);
    }

    await writeFile(page, html.replace("<!--head-->", head).replace("<!--app-->", body));
  }
  await rm(SSR_OUT, { recursive: true, force: true });

  process.stdout.write(`Built the website in ${OUT}
  `);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
