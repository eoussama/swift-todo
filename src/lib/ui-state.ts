import type { TUiState } from "./todos/todos.svelte";
import type { TListFilter } from "./todos/view";

import { browser } from "wxt/browser";



/** Where the chosen list is remembered; the background reads it too, to add captured to-dos there. */
export const FILTER_KEY = "ui:filter";

/**
 * Reads the list the popup last showed on this device.
 *
 * @param area The local storage area.
 * @param area.get Reads keys from the area.
 * @returns The filter, or `null` when none was saved.
 */
export async function readFilter(area: { get: (key: string) => Promise<Record<string, unknown>> }): Promise<TListFilter | null> {
  const value = (await area.get(FILTER_KEY))[FILTER_KEY];

  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Creates the device UI state, kept in `storage.local`.
 *
 * @returns The UI state.
 */
export function createUiState(): TUiState {
  return {
    loadFilter: async () => readFilter(browser.storage.local),
    saveFilter: async filter => browser.storage.local.set({ [FILTER_KEY]: filter }),
  };
}
