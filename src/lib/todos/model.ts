import { isObject } from "@eoussama/core";
import { customAlphabet } from "nanoid";

import { TODO_LIMITS } from "./limits";



/** Where a to-do is stored: synced with the browser account, or on this device only. */
export type TTodoLocation = "sync" | "device";

export type TTodo = {
  id: string;
  text: string;
  done: boolean;
  /** Fractional index; to-dos sort by it (see `ordering.ts`). */
  position: string;
  createdAt: number;
  updatedAt: number;
  location: TTodoLocation;
  /**
   * True when the user chose to keep this to-do on the device. Otherwise a
   * device-only to-do is just waiting for sync space and moves there on its own.
   */
  keepOnDevice: boolean;
  /** True while the change is waiting to be written to sync. */
  pending: boolean;
};

/**
 * Stored shape of a to-do. Short field names keep each item small, since
 * sync storage counts every byte of keys and JSON values.
 */
export type TTodoRecord = {
  /** Text */
  t: string;
  /** Done: 1 or 0 */
  d: 0 | 1;
  /** Position */
  p: string;
  /** Created at (ms) */
  c: number;
  /** Updated at (ms) */
  u: number;
  /** Kept on the device by the user. Only set on device records, never synced. */
  k?: 1;
};

export const TODO_KEY_PREFIX = "t:";

/** Creates a to-do ID. IDs only need to be unique per user, so 10 characters out of 36 are plenty. */
export const createId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);

/**
 * Builds the storage key of a to-do.
 *
 * @param id The to-do ID.
 * @returns The key, `t:<id>`.
 */
export function todoKey(id: string): string {
  return `${TODO_KEY_PREFIX}${id}`;
}

/**
 * Reads the to-do ID out of a storage key.
 *
 * @param key A storage key.
 * @returns The ID, or `null` when the key isn't a to-do key.
 */
export function idFromKey(key: string): string | null {
  return key.startsWith(TODO_KEY_PREFIX) && key.length > TODO_KEY_PREFIX.length
    ? key.slice(TODO_KEY_PREFIX.length)
    : null;
}

/**
 * Trims the text, folds line breaks and runs of whitespace into single
 * spaces, and cuts it to the maximum length without splitting a character.
 *
 * @param text The text as typed.
 * @returns The text to store; empty when nothing is left.
 */
export function normalizeText(text: string): string {
  let result = text.replace(/\s+/gu, " ").trim();

  if (result.length > TODO_LIMITS.maxTextLength) {
    const chars = Array.from(result);
    let length = result.length;

    while (length > TODO_LIMITS.maxTextLength) {
      length -= chars.pop()!.length;
    }

    result = chars.join("").trimEnd();
  }

  return result;
}

/**
 * Converts a to-do to its stored shape.
 *
 * @param todo The to-do fields to store.
 * @returns The compact record.
 */
export function encodeTodo(todo: Pick<TTodo, "text" | "done" | "position" | "createdAt" | "updatedAt"> & Partial<Pick<TTodo, "keepOnDevice">>): TTodoRecord {
  const record: TTodoRecord = {
    t: todo.text,
    d: todo.done ? 1 : 0,
    p: todo.position,
    c: todo.createdAt,
    u: todo.updatedAt,
  };

  if (todo.keepOnDevice === true) {
    record.k = 1;
  }

  return record;
}

/**
 * Checks that a stored value is a well-formed to-do record.
 *
 * @param value A value read from storage.
 * @returns Whether the value is a to-do record.
 */
export function isTodoRecord(value: unknown): value is TTodoRecord {
  return isObject(value)
    && typeof value.t === "string"
    && (value.d === 0 || value.d === 1)
    && typeof value.p === "string"
    && value.p.length > 0
    && typeof value.c === "number"
    && typeof value.u === "number"
    && (value.k === undefined || value.k === 1);
}

/**
 * Converts a stored record back to a to-do.
 *
 * @param id The to-do ID.
 * @param record The stored record.
 * @param location Where the record is stored.
 * @param pending Whether the record is still waiting to be written to sync.
 * @returns The to-do.
 */
export function decodeTodo(id: string, record: TTodoRecord, location: TTodoLocation, pending = false): TTodo {
  return {
    id,
    text: record.t,
    done: record.d === 1,
    position: record.p,
    createdAt: record.c,
    updatedAt: record.u,
    location,
    keepOnDevice: location === "device" && record.k === 1,
    pending,
  };
}

type TSortable = Pick<TTodo, "id" | "position" | "createdAt">;

/**
 * Orders to-dos by position, then creation time and ID, so ties between
 * items added on two devices at once stay stable.
 *
 * @param a The first to-do.
 * @param b The second to-do.
 * @returns A negative number when `a` comes first, positive when `b` does.
 */
export function compareTodos(a: TSortable, b: TSortable): number {
  if (a.position !== b.position) {
    return a.position < b.position ? -1 : 1;
  }

  if (a.createdAt !== b.createdAt) {
    return a.createdAt - b.createdAt;
  }

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Collects the to-do records in a storage area dump, skipping anything malformed.
 *
 * @param items Everything stored in one area.
 * @returns The records by to-do ID.
 */
export function readRecords(items: Record<string, unknown>): Map<string, TTodoRecord> {
  const records = new Map<string, TTodoRecord>();

  for (const [key, value] of Object.entries(items)) {
    const id = idFromKey(key);

    if (id !== null && isTodoRecord(value)) {
      records.set(id, value);
    }
  }

  return records;
}
