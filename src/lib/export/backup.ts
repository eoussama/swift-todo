import type { TImportData } from "../todos/repository";

import { isObject } from "@eoussama/core";

import { parsePrefs } from "../prefs/prefs";
import { parseRule } from "../time/recur";
import { TodoError } from "../todos/errors";
import { parseLists } from "../todos/lists";
import { decodeFields, decodeTodo, encodeTodo, normalizeText } from "../todos/model";
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

  let raw: unknown;

  try {
    raw = JSON.parse(text);
  }
  catch {
    fail();
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

    const text = normalizeText(entry.text);
    const position = typeof entry.position === "string" && /^[0-9a-z]{1,64}$/i.test(entry.position) ? entry.position : null;

    if (text.length === 0 || position === null) {
      continue;
    }

    const created = typeof entry.createdAt === "number" && Number.isFinite(entry.createdAt) ? entry.createdAt : 0;
    const updated = typeof entry.updatedAt === "number" && Number.isFinite(entry.updatedAt) ? entry.updatedAt : created;
    const source = isObject(entry.source) ? { u: entry.source.url, t: entry.source.title } : undefined;

    // Storage keeps rules it can't read, for newer versions; a backup must use ones this version knows.
    const repeat = typeof entry.repeat === "string" && parseRule(entry.repeat) !== null ? entry.repeat : undefined;

    // Reuse the storage decoder, so the same checks apply to imported fields.
    const fields = decodeFields({ t: text, d: 0, p: position, c: created, u: updated, l: entry.list, w: entry.due, r: repeat, s: source, y: entry.today } as never);

    seen.add(entry.id);
    todos.push({
      ...decodeTodo(entry.id, encodeTodo({ text, done: entry.done === true, position, createdAt: created, updatedAt: updated, ...fields }), "sync"),
      keepOnDevice: entry.keepOnDevice === true,
    });
  }

  const lists = parseLists(Array.isArray(raw.lists) ? raw.lists.map(list => (isObject(list) ? { i: list.id, n: list.name, e: list.emoji ?? undefined } : null)) : []);

  return {
    data: { todos, lists, prefs: isObject(raw.prefs) ? parsePrefs(raw.prefs) : null },
    todos: todos.length,
    lists: lists.length,
  };
}
