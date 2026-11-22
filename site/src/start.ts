import type { Component } from "svelte";

import { hydrate, mount } from "svelte";

import { markNewTabs } from "./new-tabs";

import "./app.css";



/**
 * Starts a page: its component, then the new-tab notes on its links.
 *
 * @param page The page's component.
 */
export function start(page: Component): void {
  const target = document.getElementById("app")!;

  // The built page comes rendered (see `build.ts`); the dev server's doesn't.
  if (import.meta.env.DEV) {
    mount(page, { target });
  }
  else {
    hydrate(page, { target });
  }

  markNewTabs();
}
