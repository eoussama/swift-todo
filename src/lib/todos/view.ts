import type { TList } from "./lists";
import type { TTodo } from "./model";

import { isOneOf } from "../values";
import { extractTags } from "./tags";



/**
 * Which to-dos the popup shows: every list, the Inbox, the Today view, or a
 * single list by ID.
 */
export type TListFilter = "all" | "inbox" | "today" | (string & {});

export const BUILT_IN_FILTERS = ["all", "inbox", "today"] as const;

/** The Inbox in list pickers, where it stands for to-dos without a list. */
export const INBOX = "inbox";

/**
 * Resolves the filter to one that still exists, falling back to "all" when
 * the chosen list was deleted (maybe on another device).
 *
 * @param filter The chosen filter.
 * @param lists The current lists.
 * @returns The filter to use.
 */
export function resolveFilter(filter: TListFilter, lists: ReadonlyArray<TList>): TListFilter {
  return isOneOf(BUILT_IN_FILTERS, filter) || lists.some(list => list.id === filter) ? filter : "all";
}

/**
 * Tells which list a to-do belongs to, treating unknown lists as the Inbox
 * (a list deleted on another device before this one caught up).
 *
 * @param todo The to-do.
 * @param lists The current lists.
 * @returns The list ID, or `null` for the Inbox.
 */
export function listOf(todo: Pick<TTodo, "list">, lists: ReadonlyArray<TList>): string | null {
  return lists.some(list => list.id === todo.list) ? todo.list : null;
}

export type TViewOptions = {
  filter: TListFilter;
  /** Only to-dos with this tag, or `null` for all. */
  tag: string | null;
  lists: ReadonlyArray<TList>;
  /** Decides what's in the Today view (see `time/today.ts`). */
  isToday?: (todo: TTodo) => boolean;
};

/**
 * Picks the to-dos to show for a list filter and an optional tag.
 *
 * @param todos All to-dos, in order.
 * @param options The filter, tag and lists.
 * @returns The matching to-dos, in order.
 */
export function filterTodos(todos: ReadonlyArray<TTodo>, options: TViewOptions): Array<TTodo> {
  const filter = resolveFilter(options.filter, options.lists);

  return todos.filter((todo) => {
    if (options.tag !== null && !extractTags(todo.text).includes(options.tag)) {
      return false;
    }

    switch (filter) {
      case "all":
        return true;

      case "inbox":
        return listOf(todo, options.lists) === null;

      case "today":
        return options.isToday?.(todo) ?? false;

      default:
        return listOf(todo, options.lists) === filter;
    }
  });
}

/**
 * Tells which list new to-dos go to for the current filter.
 *
 * @param filter The current filter.
 * @param lists The current lists.
 * @returns The list ID, or `null` for the Inbox.
 */
export function listForNew(filter: TListFilter, lists: ReadonlyArray<TList>): string | null {
  const resolved = resolveFilter(filter, lists);

  return isOneOf(BUILT_IN_FILTERS, resolved) ? null : resolved;
}

/**
 * Puts pinned to-dos first, each group keeping its order.
 *
 * @param todos The to-dos, in list order.
 * @returns The pinned ones, then the rest.
 */
export function pinnedFirst<T extends { pinned: boolean }>(todos: ReadonlyArray<T>): Array<T> {
  return [...todos.filter(todo => todo.pinned), ...todos.filter(todo => !todo.pinned)];
}

/**
 * Chooses which neighbor a moved to-do is placed against: one in its own
 * group (pinned or not), since the other group is sorted apart and placing
 * against it would put the to-do somewhere else than where it was dropped.
 *
 * @param list The to-dos as shown, with the moved one at its new place.
 * @param index Where the moved one is.
 * @returns Place it after or before that neighbor, or `null` when it's alone.
 */
export function moveAnchor(list: ReadonlyArray<{ id: string; pinned: boolean }>, index: number): { after: string } | { before: string } | null {
  const todo = list[index];
  const previous = list[index - 1];
  const next = list[index + 1];

  if (todo === undefined) {
    return null;
  }

  if (previous !== undefined && previous.pinned === todo.pinned) {
    return { after: previous.id };
  }

  if (next !== undefined && next.pinned === todo.pinned) {
    return { before: next.id };
  }

  return previous !== undefined ? { after: previous.id } : next !== undefined ? { before: next.id } : null;
}
