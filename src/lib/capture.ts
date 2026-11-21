import type { TList } from "./todos/lists";
import type { TTodoFields, TTodoSource } from "./todos/model";
import type { TListFilter } from "./todos/view";

import { parseTodo } from "./time/parse";
import { normalizeText } from "./todos/model";
import { listForNew } from "./todos/view";



/** Most to-dos one selection can turn into, so pasting a whole page doesn't flood the list. */
export const MAX_CAPTURED = 50;

/** A selection's lines that look like list items lose their bullets or numbers. */
const BULLET = /^\s*(?:[-*•◦▪‣·]|\d{1,3}[.)]|\[[ x]\])\s+/i;

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
  const list = listForNew(options.filter ?? "all", options.lists);

  return selection
    .split(/\r?\n/)
    .map(line => normalizeText(line.replace(BULLET, "")))
    .filter(line => line.length > 0)
    .slice(0, MAX_CAPTURED)
    .map((line) => {
      const parsed = parseTodo(line, options.now);

      return { text: parsed.text, fields: { list, due: parsed.due, repeat: parsed.repeat, source: options.source } };
    });
}
