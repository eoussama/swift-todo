import { isObject } from "@eoussama/core";
import { customAlphabet } from "nanoid";



/** A user list ("collection"). The Inbox is implicit: to-dos without a list. */
export type TList = {
  id: string;
  name: string;
  /** Optional emoji shown before the name. */
  emoji: string | null;
  /** Stored fields this version doesn't know, written back as they were. */
  extra?: Record<string, unknown>;
};

/** Stored shape of a list, with short keys. */
type TListRecord = { i: string; n: string; e?: string };

/** List IDs: short lowercase letters and digits, never a built-in view's name. */
const LIST_ID_PATTERN = /^[0-9a-z]{1,24}$/;
const RESERVED_IDS = new Set(["all", "inbox", "today"]);

/** Longest emoji kept, in UTF-16 units; enough for flags and family emoji. */
const MAX_EMOJI_LENGTH = 24;

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
  const [first] = new Intl.Segmenter().segment(trimmed);

  return first!.segment.length <= MAX_EMOJI_LENGTH ? first!.segment : null;
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
    if (!isObject(entry) || typeof entry.i !== "string" || !LIST_ID_PATTERN.test(entry.i) || RESERVED_IDS.has(entry.i) || typeof entry.n !== "string" || seen.has(entry.i)) {
      continue;
    }

    const name = normalizeListName(entry.n);

    if (name.length === 0) {
      continue;
    }

    const { i: id, n: _name, e: emoji, ...extra } = entry;

    seen.add(id);
    lists.push({
      id,
      name,
      emoji: normalizeEmoji(typeof emoji === "string" ? emoji : null),
      ...(Object.keys(extra).length > 0 ? { extra } : {}),
    });

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
  return lists.map(list => ({ ...list.extra, i: list.id, n: list.name, ...(list.emoji === null ? {} : { e: list.emoji }) }));
}
