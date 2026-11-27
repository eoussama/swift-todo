import type { TTodo } from "./model";

import { isObject } from "@eoussama/core";

import { isOneOf } from "../values";



/**
 * How a list's to-dos are ordered: by hand (dragged into place), by when they
 * were added, by due date, or by name.
 */
export const SORTS = ["manual", "newest", "oldest", "due", "alpha"] as const;
export type TSort = (typeof SORTS)[number];

/** By hand: new to-dos go to the end, and dragging puts them anywhere. */
export const DEFAULT_SORT: TSort = "manual";

/** The sort chosen for each list (or All, Today, Inbox) that isn't sorted by hand. */
export type TSorts = Readonly<Record<string, TSort>>;

/** Enough for every list and view; anything past it is left behind. */
const MAX_SORTS = 32;

/**
 * Reads the stored sorts, skipping entries that aren't one, and the default.
 *
 * @param value The stored value.
 * @returns The sorts by list or view.
 */
export function parseSorts(value: unknown): Record<string, TSort> {
  if (!isObject(value)) {
    return {};
  }

  const entries = Object.entries(value).filter((entry): entry is [string, TSort] => isOneOf(SORTS, entry[1]) && entry[1] !== DEFAULT_SORT);

  return Object.fromEntries(entries.slice(0, MAX_SORTS));
}

/**
 * Changes the sort of one list or view, dropping lists that are gone.
 *
 * @param sorts The current sorts.
 * @param id The list or view.
 * @param sort Its new sort.
 * @param keep Whether a list or view still exists.
 * @returns The sorts to store.
 */
export function withSort(sorts: TSorts, id: string, sort: TSort, keep: (id: string) => boolean): Record<string, TSort> {
  const next: Record<string, TSort> = {};

  for (const [key, value] of Object.entries(sorts)) {
    if (key !== id && keep(key)) {
      next[key] = value;
    }
  }

  if (sort !== DEFAULT_SORT) {
    next[id] = sort;
  }

  return next;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

type TSortable = Pick<TTodo, "text" | "createdAt" | "due">;

// Each compares two to-dos; ties keep the order they came in (by hand), as sorting is stable.
const COMPARE: Record<Exclude<TSort, "manual">, (a: TSortable, b: TSortable) => number> = {
  newest: (a, b) => b.createdAt - a.createdAt,
  oldest: (a, b) => a.createdAt - b.createdAt,
  // Soonest first, to-dos without a date last. A date alone comes before the same date with a time.
  due: (a, b) => (a.due === b.due ? 0 : a.due === null ? 1 : b.due === null ? -1 : a.due < b.due ? -1 : 1),
  alpha: (a, b) => collator.compare(a.text, b.text),
};

/**
 * Orders to-dos for a list's sort.
 *
 * @param todos The to-dos, in their order by hand.
 * @param sort The sort.
 * @returns The to-dos in that order; by hand, as they came.
 */
export function sortTodos<T extends TSortable>(todos: ReadonlyArray<T>, sort: TSort): Array<T> {
  return sort === "manual" ? [...todos] : [...todos].sort(COMPARE[sort]);
}
