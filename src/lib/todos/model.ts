import { isObject } from "@eoussama/core";
import { customAlphabet } from "nanoid";

import { decodeHistory, encodeHistory } from "./history";
import { TODO_LIMITS } from "./limits";



/** Where a to-do is stored: synced with the browser account, or on this device only. */
export type TTodoLocation = "sync" | "device";

/** The page a to-do was captured from, with "Add to Swift TODO". */
export type TTodoSource = {
  url: string;
  title: string | null;
};

/** The optional details a to-do can carry. `null` means "not set". */
export type TTodoFields = {
  /** List ID; `null` is the Inbox. */
  list: string | null;
  /** Due, as local wall-clock time: `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM`. */
  due: string | null;
  /** Repeat rule (see `time/recur.ts`). */
  repeat: string | null;
  source: TTodoSource | null;
  /** Pinned to Today, as the `YYYY-MM-DD` it was pinned for; expires the next day. */
  today: string | null;
  /** When a repeating to-do was checked off, in milliseconds, oldest first (see `history.ts`); empty when never. */
  history: ReadonlyArray<number>;
};

export type TTodo = TTodoFields & {
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
  /**
   * Stored fields this version doesn't know, kept as they are so an older
   * version on another device never wipes what a newer one wrote.
   */
  extra: Record<string, unknown>;
};

/**
 * Stored shape of a to-do. Short field names keep each item small, since
 * sync storage counts every byte of keys and JSON values. Optional fields are
 * only written when set.
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
  /** List ID */
  l?: string;
  /** Due (local wall-clock) */
  w?: string;
  /** Repeat rule */
  r?: string;
  /** Source page: URL and title */
  s?: { u: string; t?: string };
  /** Pinned to Today (date) */
  y?: string;
  /** Check-off history of a repeating to-do (see `history.ts`) */
  h?: string;
};

/** Record fields this version understands; anything else is kept in `extra`. */
const KNOWN_FIELDS = new Set(["t", "d", "p", "c", "u", "k", "l", "w", "r", "s", "y", "h", "x"]);

const DUE_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])(?:T(?:[01]\d|2[0-3]):[0-5]\d)?$/;
const DATE_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Longest source URL kept; longer ones lose their query and fragment, then get cut. */
export const MAX_SOURCE_URL_LENGTH = 400;
const MAX_SOURCE_TITLE_LENGTH = 120;
const MAX_LIST_ID_LENGTH = 24;
const MAX_REPEAT_LENGTH = 24;

export const EMPTY_FIELDS: Readonly<TTodoFields> = Object.freeze({
  list: null,
  due: null,
  repeat: null,
  source: null,
  today: null,
  history: Object.freeze([]),
});

/**
 * Checks a due value: `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM`.
 *
 * @param value The value to check.
 * @returns Whether it is a valid due value.
 */
export function isDue(value: unknown): value is string {
  return matchesDay(DUE_PATTERN, value);
}

// The patterns allow day 31 in any month; this also checks the day exists ("2026-02-30" doesn't).
function matchesDay(pattern: RegExp, value: unknown): value is string {
  const match = typeof value === "string" ? pattern.exec(value) : null;

  return match !== null && Number(match[3]) <= new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate();
}

/**
 * Checks a plain date value: `YYYY-MM-DD`.
 *
 * @param value The value to check.
 * @returns Whether it is a valid date.
 */
export function isDate(value: unknown): value is string {
  return matchesDay(DATE_PATTERN, value);
}

/**
 * Cleans up a page link before storing it: only http(s) pages are kept, and
 * long URLs lose their query and fragment, then get cut.
 *
 * @param url The page URL.
 * @param title The page title, if any.
 * @returns The source to store, or `null` when the URL isn't a web page.
 */
export function sanitizeSource(url: unknown, title?: unknown): TTodoSource | null {
  if (typeof url !== "string") {
    return null;
  }

  let parsed: URL;

  try {
    parsed = new URL(url);
  }
  catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  let href = parsed.href;

  if (href.length > MAX_SOURCE_URL_LENGTH) {
    parsed.search = "";
    parsed.hash = "";
    href = parsed.href.slice(0, MAX_SOURCE_URL_LENGTH);
  }

  const cleanTitle = typeof title === "string" ? normalizeText(title).slice(0, MAX_SOURCE_TITLE_LENGTH) : "";

  return { url: href, title: cleanTitle.length > 0 ? cleanTitle : null };
}

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
  const cut = text.replace(/\s+/gu, " ").trim().slice(0, TODO_LIMITS.maxTextLength);

  // Don't leave half of an emoji (a surrogate pair) at the end.
  return (/[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut).trimEnd();
}

export type TEncodable = Pick<TTodo, "text" | "done" | "position" | "createdAt" | "updatedAt">
  & Partial<Pick<TTodo, "keepOnDevice" | "extra"> & TTodoFields>;

/**
 * Converts a to-do to its stored shape. Unknown fields read earlier are
 * written back as they were.
 *
 * @param todo The to-do fields to store.
 * @returns The compact record.
 */
export function encodeTodo(todo: TEncodable): TTodoRecord {
  const record: TTodoRecord = {
    ...todo.extra,
    t: todo.text,
    d: todo.done ? 1 : 0,
    p: todo.position,
    c: todo.createdAt,
    u: todo.updatedAt,
  };

  if (todo.keepOnDevice === true) {
    record.k = 1;
  }

  if (todo.list != null) {
    record.l = todo.list;
  }

  if (todo.due != null) {
    record.w = todo.due;
  }

  if (todo.repeat != null) {
    record.r = todo.repeat;
  }

  if (todo.source != null) {
    record.s = todo.source.title === null ? { u: todo.source.url } : { u: todo.source.url, t: todo.source.title };
  }

  if (todo.today != null) {
    record.y = todo.today;
  }

  if (todo.history != null && todo.history.length > 0) {
    record.h = encodeHistory(todo.history);
  }

  return record;
}

/**
 * Reads the optional details of a record, dropping any that are malformed
 * rather than the whole to-do.
 *
 * @param record The stored record.
 * @returns The details, `null` where unset or invalid.
 */
export function decodeFields(record: TTodoRecord): TTodoFields {
  const list = typeof record.l === "string" && record.l.length > 0 && record.l.length <= MAX_LIST_ID_LENGTH ? record.l : null;
  const repeat = typeof record.r === "string" && record.r.length > 0 && record.r.length <= MAX_REPEAT_LENGTH ? record.r : null;
  const source = isObject(record.s) ? sanitizeSource(record.s.u, record.s.t) : null;

  return {
    list,
    due: isDue(record.w) ? record.w : null,
    repeat,
    source,
    today: isDate(record.y) ? record.y : null,
    history: decodeHistory(record.h),
  };
}

function readExtra(record: TTodoRecord): Record<string, unknown> {
  const extra: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (!KNOWN_FIELDS.has(key)) {
      extra[key] = value;
    }
  }

  return extra;
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
    ...decodeFields(record),
    extra: readExtra(record),
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
  if (a.position < b.position) {
    return -1;
  }

  if (a.position > b.position) {
    return 1;
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

// Trash

/** A deleted to-do, kept in local storage only so it doesn't use sync space. */
export type TTrashRecord = TTodoRecord & {
  /** Deleted at (ms) */
  x: number;
};

export type TTrashedTodo = TTodo & { deletedAt: number };

export const TRASH_KEY_PREFIX = "x:";

/**
 * Builds the storage key of a trashed to-do.
 *
 * @param id The to-do ID.
 * @returns The key, `x:<id>`.
 */
export function trashKey(id: string): string {
  return `${TRASH_KEY_PREFIX}${id}`;
}

/**
 * Reads the to-do ID out of a trash key.
 *
 * @param key A storage key.
 * @returns The ID, or `null` when the key isn't a trash key.
 */
export function idFromTrashKey(key: string): string | null {
  return key.startsWith(TRASH_KEY_PREFIX) && key.length > TRASH_KEY_PREFIX.length
    ? key.slice(TRASH_KEY_PREFIX.length)
    : null;
}

/**
 * Checks that a stored value is a well-formed trash record.
 *
 * @param value A value read from storage.
 * @returns Whether the value is a trash record.
 */
export function isTrashRecord(value: unknown): value is TTrashRecord {
  return isTodoRecord(value) && typeof (value as { x?: unknown }).x === "number";
}

/**
 * Collects the trash records in a storage area dump, skipping anything malformed.
 *
 * @param items Everything stored in the local area.
 * @returns The trash records by to-do ID.
 */
export function readTrash(items: Record<string, unknown>): Map<string, TTrashRecord> {
  const records = new Map<string, TTrashRecord>();

  for (const [key, value] of Object.entries(items)) {
    const id = idFromTrashKey(key);

    if (id !== null && isTrashRecord(value)) {
      records.set(id, value);
    }
  }

  return records;
}

/**
 * Converts a trash record back to a trashed to-do.
 *
 * @param id The to-do ID.
 * @param record The stored trash record.
 * @returns The trashed to-do; it restores to the device when it was kept there.
 */
export function decodeTrashed(id: string, record: TTrashRecord): TTrashedTodo {
  return {
    ...decodeTodo(id, record, record.k === 1 ? "device" : "sync"),
    deletedAt: record.x,
  };
}
