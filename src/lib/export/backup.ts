import type { TImportData } from "../todos/repository";

import { isObject } from "@eoussama/core";

import { parsePrefs } from "../prefs/prefs";
import { parseRule } from "../time/recur";
import { TodoError } from "../todos/errors";
import { encodeHistory } from "../todos/history";
import { parseLists } from "../todos/lists";
import { decodeFields, decodeTodo, encodeTodo, normalizeTodoText } from "../todos/model";
import { isOrderKey } from "../todos/ordering";
import { BACKUP_APP } from "./formats";



/** Largest backup accepted, in characters, and most to-dos in one. */
export const MAX_BACKUP_SIZE = 5_000_000;
export const MAX_BACKUP_TODOS = 5_000;

const ID_PATTERN = /^[0-9a-z]{1,32}$/;

export type TBackupPreview = {
  data: TImportData;
  todos: number;
  lists: number;
};

function fail(): never {
  throw new TodoError("invalid-backup");
}

/**
 * Reads and checks a backup file. Anything malformed in a to-do (a bad date,
 * an unsafe link) is dropped rather than imported; a file that isn't a
 * Swift TODO backup is refused.
 *
 * @param text The file's content.
 * @returns What will be imported, with counts for a preview.
 * @throws {TodoError} `invalid-backup` when the file isn't a usable backup.
 */
export function parseBackup(text: string): TBackupPreview {
  if (text.length > MAX_BACKUP_SIZE) {
    fail();
  }

  let raw: unknown = null;

  try {
    raw = JSON.parse(text);
  }
  catch {
    // Not JSON: refused just below, like any other non-backup.
  }

  if (!isObject(raw) || raw.app !== BACKUP_APP || typeof raw.version !== "number" || !Array.isArray(raw.todos)) {
    fail();
  }

  const seen = new Set<string>();
  const todos = [];

  for (const entry of raw.todos.slice(0, MAX_BACKUP_TODOS)) {
    if (!isObject(entry) || typeof entry.id !== "string" || !ID_PATTERN.test(entry.id) || seen.has(entry.id) || typeof entry.text !== "string") {
      continue;
    }

    const text = normalizeTodoText(entry.text);
    const position = typeof entry.position === "string" && entry.position.length <= 64 && isOrderKey(entry.position) ? entry.position : null;

    if (text.length === 0 || position === null) {
      continue;
    }

    // Number.isFinite is false for anything that isn't a number.
    const created = Number.isFinite(entry.createdAt) ? entry.createdAt as number : 0;
    const updated = Number.isFinite(entry.updatedAt) ? entry.updatedAt as number : created;
    const source = isObject(entry.source) ? { u: entry.source.url, t: entry.source.title } : undefined;

    // Storage keeps rules it can't read, for newer versions; a backup must use ones this version knows.
    // Stryker disable next-line ConditionalExpression: without the typeof check, a non-string that reads as a rule (["1d"]) is still dropped by decodeFields.
    const repeat = typeof entry.repeat === "string" && parseRule(entry.repeat) !== null ? entry.repeat : undefined;

    // Reuse the storage decoder, so the same checks apply to imported fields.
    const history = Array.isArray(entry.history) ? encodeHistory(entry.history.filter(time => Number.isFinite(time) && (time as number) > 0) as Array<number>) : undefined;
    const fields = decodeFields({ t: text, d: 0, p: position, c: created, u: updated, l: entry.list, w: entry.due, r: repeat, s: source, y: entry.today, h: history, v: entry.hidden === true ? 1 : undefined, n: entry.pinned === true ? 1 : undefined } as never);

    seen.add(entry.id);
    todos.push({
      ...decodeTodo(entry.id, encodeTodo({ text, done: entry.done === true, position, createdAt: created, updatedAt: updated, ...fields }), "sync"),
      keepOnDevice: entry.keepOnDevice === true,
    });
  }

  // A missing or odd "lists" becomes entries that parseLists skips.
  const lists = parseLists([raw.lists].flat().map(list => (isObject(list) ? { i: list.id, n: list.name, e: list.emoji ?? undefined } : null)));

  return {
    data: { todos, lists, prefs: isObject(raw.prefs) ? parsePrefs(raw.prefs) : null },
    todos: todos.length,
    lists: lists.length,
  };
}
