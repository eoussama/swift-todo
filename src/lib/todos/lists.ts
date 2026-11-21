import { isObject } from "@eoussama/core";
import { customAlphabet } from "nanoid";



/** A user list ("collection"). The Inbox is implicit: to-dos without a list. */
export type TList = {
  id: string;
  name: string;
  /** Optional emoji shown before the name. */
  emoji: string | null;
};

/** Stored shape of a list, with short keys. */
type TListRecord = { i: string; n: string; e?: string };

export const MAX_LISTS = 20;
export const MAX_LIST_NAME_LENGTH = 32;

/** Creates a list ID, short since every to-do in the list stores it. */
export const createListId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 6);

/**
 * Cleans up a list name: single spaces, trimmed and cut to the maximum length.
 *
 * @param name The name as typed.
 * @returns The name to store; empty when nothing is left.
 */
export function normalizeListName(name: string): string {
  return Array.from(name.replace(/\s+/gu, " ").trim()).slice(0, MAX_LIST_NAME_LENGTH).join("").trim();
}

/**
 * Keeps only the first character (grapheme) of an emoji field.
 *
 * @param emoji The emoji as typed.
 * @returns A single grapheme, or `null` when empty.
 */
export function normalizeEmoji(emoji: string | null | undefined): string | null {
  const trimmed = emoji?.trim() ?? "";

  if (trimmed.length === 0) {
    return null;
  }

  // A non-empty string always has a first grapheme.
  const [first] = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(trimmed);

  return first!.segment;
}

/**
 * Reads the stored lists document, skipping malformed or duplicate entries.
 *
 * @param value The stored value.
 * @returns The lists, in order.
 */
export function parseLists(value: unknown): Array<TList> {
  if (!Array.isArray(value)) {
    return [];
  }

  const lists: Array<TList> = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (!isObject(entry) || typeof entry.i !== "string" || entry.i.length === 0 || typeof entry.n !== "string" || seen.has(entry.i)) {
      continue;
    }

    const name = normalizeListName(entry.n);

    if (name.length === 0) {
      continue;
    }

    seen.add(entry.i);
    lists.push({ id: entry.i, name, emoji: normalizeEmoji(typeof entry.e === "string" ? entry.e : null) });

    if (lists.length === MAX_LISTS) {
      break;
    }
  }

  return lists;
}

/**
 * Converts lists to their stored shape.
 *
 * @param lists The lists, in order.
 * @returns The value to store.
 */
export function encodeLists(lists: ReadonlyArray<TList>): Array<TListRecord> {
  return lists.map(list => (list.emoji === null ? { i: list.id, n: list.name } : { i: list.id, n: list.name, e: list.emoji }));
}
