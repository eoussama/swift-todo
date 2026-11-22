import type { TList } from "./todos/lists";
import type { TTodoFields, TTodoSource } from "./todos/model";
import type { TListFilter } from "./todos/view";

import { toDateString } from "./time/date";
import { parseTodo } from "./time/parse";
import { normalizeText, sanitizeSource } from "./todos/model";
import { listForNew } from "./todos/view";



/** Most to-dos one selection can turn into, so pasting a whole page doesn't flood the list. */
export const MAX_CAPTURED = 50;

/** A selection's lines that look like list items lose their bullets or numbers. */
const BULLET = /^\s*(?:[-*•◦▪‣·]|\d{1,3}[.)]|\[[ x]\])\s/i;

export type TCaptureOptions = {
  /** The list the popup last showed, so captured to-dos land there. */
  filter: TListFilter | null;
  lists: ReadonlyArray<TList>;
  source: TTodoSource | null;
  now: Date;
};

/**
 * Turns selected text into to-dos: one per non-empty line, without list
 * bullets, with dates and repeats understood, filed in the current list and
 * linked to the page.
 *
 * @param selection The selected text.
 * @param options Where they go and where they came from.
 * @returns The to-dos to add, at most {@link MAX_CAPTURED}.
 */
export function captureItems(selection: string, options: TCaptureOptions): Array<{ text: string; fields: Partial<TTodoFields> }> {
  // Stryker disable next-line StringLiteral: any filter that isn't a list files into the Inbox, like "all".
  const list = listForNew(options.filter ?? "all", options.lists);

  return selection
    .split(/\r?\n/)
    .map(line => normalizeText(line.replace(BULLET, "")))
    .filter(line => line.length > 0)
    .slice(0, MAX_CAPTURED)
    .map((line) => {
      const parsed = parseTodo(line, options.now);

      // From the Today tab, an undated to-do is pinned there, as when typed in the popup.
      const today = options.filter === "today" && parsed.due === null ? toDateString(options.now) : null;

      return { text: parsed.text, fields: { list, due: parsed.due, repeat: parsed.repeat, source: options.source, today } };
    });
}

/** What "Add to Swift TODO" needs from the browser and storage, passed in so it can be tested. */
export type TCaptureDeps = {
  /** Runs a script in the tab (or one frame of it) and gives its results, like `scripting.executeScript`. */
  runInTab: (tabId: number, frameId: number | undefined) => Promise<ReadonlyArray<{ result?: unknown } | undefined>>;
  lists: () => Promise<ReadonlyArray<TList>>;
  filter: () => Promise<TListFilter | null>;
  addMany: (items: ReadonlyArray<{ text: string; fields: Partial<TTodoFields> }>) => Promise<unknown>;
  /** Shows "+N" on the toolbar badge. */
  flash: (count: number) => Promise<void>;
  /** Shows the "Added" note on the page. May fail on pages that refuse scripts. */
  toast: (tabId: number, count: number) => Promise<void>;
  now: () => Date;
};

/** The right-click menu's details about the click. */
export type TCaptureClick = { selectionText?: string; pageUrl?: string; frameId?: number };

/** The tab the menu was used in. */
export type TCaptureTab = { id?: number; url?: string; title?: string };

/**
 * Builds the handler for "Add to Swift TODO" on selected text. It reads the
 * selection from the page, with its line breaks (the menu's `selectionText`
 * flattens them, so that's only the fallback), turns each line into a to-do
 * linked to the page, then flashes the count on the badge and in a note on the page.
 *
 * @param deps The browser and storage calls it uses.
 * @returns The handler, resolving to how many to-dos were added.
 */
export function createCapture(deps: TCaptureDeps): (click: TCaptureClick, tab?: TCaptureTab) => Promise<number> {
  async function selectionIn(tabId: number | undefined, frameId: number | undefined): Promise<string | null> {
    if (tabId === undefined) {
      return null;
    }

    let results: ReadonlyArray<{ result?: unknown } | undefined>;

    try {
      results = await deps.runInTab(tabId, frameId);
    }
    catch {
      // The browser's own pages and the stores refuse scripts.
      return null;
    }

    const selection = results[0]?.result;

    return typeof selection === "string" && selection.trim().length > 0 ? selection : null;
  }

  return async (click, tab) => {
    // At once: none of the three needs another.
    const [selection, filter, lists] = await Promise.all([selectionIn(tab?.id, click.frameId), deps.filter(), deps.lists()]);
    const items = captureItems(selection ?? click.selectionText ?? "", {
      filter,
      lists,
      source: sanitizeSource(click.pageUrl ?? tab?.url, tab?.title),
      now: deps.now(),
    });

    if (items.length === 0) {
      return 0;
    }

    await deps.addMany(items);
    await deps.flash(items.length);

    if (tab?.id !== undefined) {
      await deps.toast(tab.id, items.length).catch(() => {});
    }

    return items.length;
  };
}
