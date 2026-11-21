import type { TPrefs } from "../prefs/prefs";
import type { TList } from "../todos/lists";
import type { TTodo } from "../todos/model";

import { formatRule } from "../time/format";
import { extractTags } from "../todos/tags";
import { listOf } from "../todos/view";



/** Identifies a Swift TODO backup file. */
export const BACKUP_APP = "swift-todo";
export const BACKUP_VERSION = 1;

export type TBackupTodo = {
  id: string;
  text: string;
  done: boolean;
  position: string;
  createdAt: number;
  updatedAt: number;
  list: string | null;
  due: string | null;
  repeat: string | null;
  source: { url: string; title: string | null } | null;
  today: string | null;
  /** Check-off times of a repeating to-do, in milliseconds, oldest first. */
  history: ReadonlyArray<number>;
  keepOnDevice: boolean;
};

export type TBackup = {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  lists: Array<{ id: string; name: string; emoji: string | null }>;
  todos: Array<TBackupTodo>;
  prefs: TPrefs;
};

/**
 * Builds a full backup: lists, every to-do with all its details, and settings.
 *
 * @param data The to-dos, lists and settings.
 * @param data.todos Every to-do.
 * @param data.lists The lists.
 * @param data.prefs The settings.
 * @param now When the backup is made.
 * @returns The backup, ready for `JSON.stringify`.
 */
export function toBackup(data: { todos: ReadonlyArray<TTodo>; lists: ReadonlyArray<TList>; prefs: TPrefs }, now: Date): TBackup {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    lists: data.lists.map(list => ({ id: list.id, name: list.name, emoji: list.emoji })),
    todos: data.todos.map(todo => ({
      id: todo.id,
      text: todo.text,
      done: todo.done,
      position: todo.position,
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
      list: todo.list,
      due: todo.due,
      repeat: todo.repeat,
      source: todo.source,
      today: todo.today,
      history: todo.history,
      keepOnDevice: todo.keepOnDevice,
    })),
    prefs: data.prefs,
  };
}

function groupByList(todos: ReadonlyArray<TTodo>, lists: ReadonlyArray<TList>, inbox: string): Array<{ name: string; todos: Array<TTodo> }> {
  const groups = [{ id: null as string | null, name: inbox }, ...lists.map(list => ({ id: list.id as string | null, name: list.emoji === null ? list.name : `${list.emoji} ${list.name}` }))];

  return groups
    .map(group => ({ name: group.name, todos: todos.filter(todo => listOf(todo, lists) === group.id) }))
    .filter(group => group.todos.length > 0);
}

/**
 * Writes to-dos as a Markdown checklist, grouped by list, with 📅 dates and 🔁 repeats.
 *
 * @param todos The to-dos.
 * @param lists The lists, for headings.
 * @param inbox The Inbox's name, in the user's language.
 * @returns The Markdown text.
 */
export function toMarkdown(todos: ReadonlyArray<TTodo>, lists: ReadonlyArray<TList>, inbox: string): string {
  // Escape characters that would start Markdown structure (or HTML) in user text.
  const escape = (text: string): string => text.replace(/([\\`*_[\]<>])/g, "\\$1");

  return groupByList(todos, lists, inbox)
    .map(group => [
      `## ${escape(group.name)}`,
      "",
      ...group.todos.map((todo) => {
        const details = [
          todo.due === null ? "" : ` 📅 ${todo.due.replace("T", " ")}`,
          todo.repeat === null ? "" : ` 🔁 ${formatRule(todo.repeat)}`,
          todo.source === null ? "" : ` [↗](${todo.source.url.replace(/\)/g, "%29")})`,
        ].join("");

        return `- [${todo.done ? "x" : " "}] ${escape(todo.text)}${details}`;
      }),
    ].join("\n"))
    .join("\n\n")
    .concat("\n");
}

/**
 * Quotes a CSV field, and neutralizes values a spreadsheet would run as a formula.
 *
 * @param value The field value.
 * @returns The safe, quoted field.
 */
export function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;

  return /[",\n\r]/.test(safe) || safe !== value ? `"${safe.replace(/"/g, "\"\"")}"` : safe;
}

/**
 * Writes to-dos as CSV, one row per to-do.
 *
 * @param todos The to-dos.
 * @param lists The lists, for names.
 * @param inbox The Inbox's name, in the user's language.
 * @returns The CSV text, with a header row.
 */
export function toCsv(todos: ReadonlyArray<TTodo>, lists: ReadonlyArray<TList>, inbox: string): string {
  const rows = todos.map((todo) => {
    const list = lists.find(item => item.id === listOf(todo, lists));

    return [
      list?.name ?? inbox,
      todo.text,
      todo.done ? "yes" : "no",
      todo.due ?? "",
      // Stryker disable next-line ConditionalExpression: formatRule gives "" for no rule as well.
      todo.repeat === null ? "" : formatRule(todo.repeat),
      extractTags(todo.text).join(" "),
      todo.source?.url ?? "",
    ].map(csvField).join(",");
  });

  return [["list", "text", "done", "due", "repeat", "tags", "source"].join(","), ...rows].join("\r\n").concat("\r\n");
}

/**
 * Writes to-dos as plain text, one per line with a box.
 *
 * @param todos The to-dos.
 * @returns The text.
 */
export function toPlainText(todos: ReadonlyArray<TTodo>): string {
  return todos.map(todo => `${todo.done ? "☑" : "☐"} ${todo.text}`).join("\n");
}
