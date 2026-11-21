import { render as renderSvelte } from "svelte/server";

import App from "./App.svelte";
import Privacy from "./Privacy.svelte";



const PAGES = { "index.html": App, "privacy/index.html": Privacy };

export type TPage = keyof typeof PAGES;

/**
 * Renders a page to HTML at build time.
 *
 * @param page The page, by its file.
 * @returns The head and body markup.
 */
export function render(page: TPage): { head: string; body: string } {
  return renderSvelte(PAGES[page]);
}
