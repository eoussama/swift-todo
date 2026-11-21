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

/** Whether the popup opens in focus mode on this device. */
export const FOCUS_KEY = "ui:focus";

/**
 * Reads whether focus mode was on.
 *
 * @returns Whether it was on.
 */
export async function readFocusMode(): Promise<boolean> {
  return (await browser.storage.local.get(FOCUS_KEY))[FOCUS_KEY] === true;
}

/**
 * Remembers whether focus mode is on.
 *
 * @param on Whether it's on.
 * @returns Once saved.
 */
export async function saveFocusMode(on: boolean): Promise<void> {
  await browser.storage.local.set({ [FOCUS_KEY]: on });
}

/** The to-dos skipped in focus mode, in the order they were skipped, so the queue survives the popup closing. */
export const FOCUS_SKIPPED_KEY = "ui:focus-skipped";

/**
 * Reads the to-dos skipped in focus mode.
 *
 * @returns Their IDs, oldest skip first.
 */
export async function readFocusSkipped(): Promise<Array<string>> {
  const value = (await browser.storage.local.get(FOCUS_SKIPPED_KEY))[FOCUS_SKIPPED_KEY];

  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

/**
 * Remembers the to-dos skipped in focus mode.
 *
 * @param ids Their IDs, oldest skip first.
 * @returns Once saved.
 */
export async function saveFocusSkipped(ids: ReadonlyArray<string>): Promise<void> {
  await browser.storage.local.set({ [FOCUS_SKIPPED_KEY]: [...ids] });
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
