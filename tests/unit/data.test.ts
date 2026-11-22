import type { TTodo } from "~/lib/todos/model";

import { describe, expect, it } from "vitest";

import { captureItems, MAX_CAPTURED } from "~/lib/capture";
import { MAX_BACKUP_SIZE, MAX_BACKUP_TODOS, parseBackup } from "~/lib/export/backup";
import { exportName } from "~/lib/export/download";
import { BACKUP_APP, BACKUP_VERSION, csvField, toBackup, toCsv, toMarkdown, toPlainText } from "~/lib/export/formats";
import { DEFAULT_PREFS } from "~/lib/prefs/prefs";
import { toDateString } from "~/lib/time/date";
import { TodoError } from "~/lib/todos/errors";

import { createDevice } from "./helpers";



// Saturday 2026-11-21, 10:30 local time.
const NOW = new Date(2026, 10, 21, 10, 30);
const lists = [{ id: "work01", name: "Work", emoji: "💼" }, { id: "home01", name: "Home", emoji: null }];
const source = { url: "https://example.com/post", title: "A post" };

function todo(overrides: Partial<TTodo> = {}): TTodo {
  return {
    id: "a1",
    text: "Task",
    done: false,
    position: "a0",
    createdAt: 1,
    updatedAt: 2,
    location: "sync",
    pending: false,
    keepOnDevice: false,
    list: null,
    due: null,
    repeat: null,
    source: null,
    today: null,
    history: [],
    hidden: false,
    pinned: false,
    extra: {},
    ...overrides,
  };
}

function backupText(todos: Array<unknown>, rest: Record<string, unknown> = {}): string {
  return JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION, todos, ...rest });
}

describe("capturing a selection", () => {
  const options = { filter: "work01" as const, lists, source, now: NOW };

  it("makes one to-do per line, without bullets, in the current list", () => {
    const items = captureItems("  - Buy milk\n\n* Call Sam tomorrow 3pm\r\n2) Pay rent every month\n[x] Done thing\n• Last", options);

    expect(items.map(item => item.text)).toEqual(["Buy milk", "Call Sam", "Pay rent", "Done thing", "Last"]);
    expect(items[0]?.fields).toEqual({ list: "work01", due: null, repeat: null, source, today: null });
    expect(items[1]?.fields.due).toBe("2026-11-22T15:00");
    expect(items[2]?.fields.repeat).toBe("1M");
  });

  it("files into the Inbox when the last view isn't a list", () => {
    // Captured with the Today tab open: undated lines are added to Today, dated ones keep their date.
    expect(captureItems("Undated\nDated tomorrow", { ...options, filter: "today" }).map(item => item.fields.today)).toEqual([toDateString(options.now), null]);
    expect(captureItems("x", { ...options, filter: null })[0]?.fields.list).toBeNull();
    expect(captureItems("x", { ...options, filter: "gone01" })[0]?.fields.list).toBeNull();
  });

  it("keeps hyphenated words and caps how many it takes", () => {
    expect(captureItems("-not a bullet", options)[0]?.text).toBe("-not a bullet");
    expect(captureItems(Array.from({ length: 80 }, (_, index) => `Line ${index}`).join("\n"), options)).toHaveLength(MAX_CAPTURED);
    expect(captureItems(" \n\t\n", options)).toEqual([]);
  });
});

describe("export formats", () => {
  const todos = [
    todo({ id: "a1", text: "Plan #q3 *launch*", list: "work01", due: "2026-11-24T15:00", repeat: "1w", source: { url: "https://x.test/a)b", title: null } }),
    todo({ id: "a2", text: "Water plants", done: true, list: "home01" }),
    todo({ id: "a3", text: "=SUM(A1)", list: "gone01" }),
  ];

  it("writes Markdown checklists grouped by list", () => {
    expect(toMarkdown(todos, lists, "Inbox", "Hidden to-do")).toBe([
      "## Inbox",
      "",
      "- [ ] =SUM(A1)",
      "",
      "## 💼 Work",
      "",
      "- [ ] Plan #q3 \\*launch\\* 📅 2026-11-24 15:00 🔁 repeat_weeks(1) [↗](https://x.test/a%29b)",
      "",
      "## Home",
      "",
      "- [x] Water plants",
      "",
    ].join("\n"));
  });

  it("writes CSV with a header, quoting and no formulas", () => {
    expect(toCsv(todos, lists, "Inbox", "Hidden to-do")).toBe([
      "list,text,done,due,repeat,tags,source",
      "Work,Plan #q3 *launch*,no,2026-11-24T15:00,repeat_weeks(1),q3,https://x.test/a)b",
      "Home,Water plants,yes,,,,",
      "Inbox,\"'=SUM(A1)\",no,,,,",
      "",
    ].join("\r\n"));
  });

  it("guards every formula trigger and quotes separators", () => {
    for (const lead of ["=", "+", "-", "@", "\t", "\r"]) {
      expect(csvField(`${lead}1`)).toBe(`"'${lead}1"`);
    }

    expect(csvField("a,b")).toBe("\"a,b\"");
    expect(csvField("say \"hi\"")).toBe("\"say \"\"hi\"\"\"");
    expect(csvField("two\nlines")).toBe("\"two\nlines\"");
    expect(csvField("plain")).toBe("plain");
  });

  it("writes plain text with boxes", () => {
    expect(toPlainText(todos.slice(0, 2), "Hidden to-do")).toBe("☐ Plan #q3 *launch*\n☑ Water plants");
    expect(toPlainText([{ ...todos[0]!, hidden: true }], "Hidden to-do")).toBe("☐ Hidden to-do");

    // Markdown and CSV show a hidden to-do only as hidden: no text, tags or link, but its date and repeat stay.
    const secret = { ...todos[0]!, text: "Safe code 4321 #vault", hidden: true, due: "2026-11-24", repeat: "wd", source };

    expect(toMarkdown([secret], lists, "Inbox", "Hidden to-do")).not.toMatch(/4321|vault|example/);
    expect(toMarkdown([secret], lists, "Inbox", "Hidden to-do")).toContain("- [ ] Hidden to-do 📅 2026-11-24 🔁 ");
    expect(toCsv([secret], lists, "Inbox", "Hidden to-do").split("\r\n")[1]).toMatch(/^[^,]*,Hidden to-do,no,2026-11-24,[^,]+,,$/);
    // The backup keeps it all, to restore it.
    expect(JSON.stringify(toBackup({ todos: [secret], lists, prefs: DEFAULT_PREFS }, NOW))).toContain("Safe code 4321 #vault");
  });

  it("names files after the day", () => {
    expect(exportName(NOW, "csv")).toBe("swift-todo-2026-11-21.csv");
  });
});

describe("backups", () => {
  it("round-trips everything through a backup", async () => {
    const device = createDevice();
    const original = [
      todo({ id: "a1", text: "Plan", list: "work01", due: "2026-11-24", repeat: "wd", source, today: "2026-11-21" }),
      todo({ id: "a2", text: "Kept", done: true, keepOnDevice: true, position: "a1" }),
    ];
    const backup = toBackup({ todos: original, lists, prefs: { ...DEFAULT_PREFS, skin: "chalk" } }, NOW);

    expect(backup).toMatchObject({ app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: NOW.toISOString() });

    const preview = parseBackup(JSON.stringify(backup));

    expect(preview).toMatchObject({ todos: 2, lists: 2 });
    expect(preview.data.prefs?.skin).toBe("chalk");
    expect(preview.data.todos[0]).toMatchObject({ id: "a1", text: "Plan", list: "work01", due: "2026-11-24", repeat: "wd", source, today: "2026-11-21", done: false });
    expect(preview.data.todos[1]).toMatchObject({ id: "a2", done: true, keepOnDevice: true });

    await device.repository.importData(preview.data, "replace");

    const snapshot = await device.repository.load();

    expect(snapshot.todos.map(item => [item.id, item.text, item.due, item.list])).toEqual([["a1", "Plan", "2026-11-24", "work01"], ["a2", "Kept", null, null]]);
    expect(snapshot.lists).toEqual(lists);
  });

  it("refuses files that aren't backups", () => {
    for (const text of ["not json", "[]", "null", JSON.stringify({ app: "other", version: 1, todos: [] }), JSON.stringify({ app: BACKUP_APP, todos: [] }), JSON.stringify({ app: BACKUP_APP, version: 1, todos: {} }), " ".repeat(MAX_BACKUP_SIZE + 1)]) {
      expect(() => parseBackup(text), text.slice(0, 20)).toThrow(TodoError);
    }
  });

  it("drops malformed and unsafe entries", () => {
    const valid = { id: "ok1", text: "Fine", position: "a0" };
    const preview = parseBackup(backupText([
      valid,
      { ...valid },
      { ...valid, id: "Bad-ID" },
      { ...valid, id: "e1", text: "   " },
      { ...valid, id: "e2", text: 5 },
      { ...valid, id: "e3", position: "not valid!" },
      { id: "e6", text: "No position" },
      { ...valid, id: "e7", position: 5 },
      // A well-formed key, but longer than any this app makes.
      { ...valid, id: "e8", position: `a0${"V".repeat(63)}` },
      "junk",
      { ...valid, id: "e4", due: "someday", repeat: "often", list: 5, today: "x", source: { url: "javascript:alert(1)", title: "x" }, createdAt: "x", updatedAt: Number.NaN },
      { ...valid, id: "e5", source: "x" },
    ], { lists: [{ id: "l1", name: "Ok", emoji: null }, { id: "l2", name: "  " }, 3], prefs: "x" }));

    expect(preview.data.todos.map(item => item.id)).toEqual(["ok1", "e4", "e5"]);
    expect(preview.data.todos[1]).toMatchObject({ due: null, repeat: null, list: null, today: null, source: null, createdAt: 0, updatedAt: 0, done: false, keepOnDevice: false });
    expect(preview.data.todos[2]?.source).toBeNull();
    expect(preview.data.lists.map(list => list.id)).toEqual(["l1"]);
    expect(preview.data.prefs).toBeNull();
  });

  it("keeps the updated time apart from the created one and caps the count", () => {
    const preview = parseBackup(backupText([{ id: "a", text: "x", position: "a0", createdAt: 5 }, { id: "b", text: "y", position: "a1", createdAt: 5, updatedAt: 9 }], { lists: "x" }));

    expect(preview.data.todos.map(item => [item.createdAt, item.updatedAt])).toEqual([[5, 5], [5, 9]]);
    expect(preview.lists).toBe(0);

    const many = Array.from({ length: MAX_BACKUP_TODOS + 3 }, (_, index) => ({ id: `t${index}`, text: "x", position: "a0" }));

    expect(parseBackup(backupText(many)).todos).toBe(MAX_BACKUP_TODOS);
  });
});
