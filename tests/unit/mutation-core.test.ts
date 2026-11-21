import { describe, expect, it } from "vitest";

import { parseBackup } from "~/lib/export/backup";
import { toMarkdown } from "~/lib/export/formats";
import { TODO_LIMITS } from "~/lib/todos/limits";
import { encodeLists, normalizeEmoji, parseLists } from "~/lib/todos/lists";
import {
  compareTodos,
  decodeFields,
  decodeTodo,
  decodeTrashed,
  EMPTY_FIELDS,
  encodeTodo,
  idFromTrashKey,
  isDate,
  isDue,
  isTodoRecord,
  isTrashRecord,
  MAX_SOURCE_URL_LENGTH,
  normalizeText,
  readTrash,
  sanitizeSource,
} from "~/lib/todos/model";
import { isOrderKey } from "~/lib/todos/ordering";



const RECORD = { t: "Task", d: 0, p: "a0", c: 1, u: 2 } as const;

describe("to-do records", () => {
  it("accept only real due values and dates", () => {
    for (const value of ["2026-11-21", "2026-11-21T00:00", "2026-11-21T23:59", "2026-01-31", "2026-12-10", "2026-11-30"]) {
      expect(isDue(value), value).toBe(true);
    }

    for (const value of [5, null, "x2026-11-21", "2026-11-21x", "2026-11-00", "2026-11-32", "2026-11-3a", "2026-00-10", "2026-13-10", "2026-11-21T24:00", "2026-11-21T12:60", "2026-11-21T1:00"]) {
      expect(isDue(value), String(value)).toBe(false);
    }

    expect(isDate("2026-11-21")).toBe(true);
    expect(isDate("2026-11-30")).toBe(true);
  });

  it("reject days a month doesn't have", () => {
    expect(isDue("2026-02-28")).toBe(true);
    expect(isDue("2028-02-29T10:00")).toBe(true);
    expect(isDue("2026-12-31")).toBe(true);
    expect(isDue("2026-02-29")).toBe(false);
    expect(isDue("2026-02-30T10:00")).toBe(false);
    expect(isDue("2026-04-31")).toBe(false);
    expect(isDate("2026-04-30")).toBe(true);
    expect(isDate("2026-04-31")).toBe(false);

    for (const value of [5, "x2026-11-21", "2026-11-21x", "2026-11-21T10:00", "2026-00-10", "2026-0a-10", "2026-11-00", "2026-11-32", "2026-11-3x"]) {
      expect(isDate(value), String(value)).toBe(false);
    }
  });

  it("start with no details", () => {
    expect(EMPTY_FIELDS).toEqual({ list: null, due: null, repeat: null, source: null, today: null, history: [], hidden: false });
    expect(Object.isFrozen(EMPTY_FIELDS)).toBe(true);
    expect(Object.isFrozen(EMPTY_FIELDS.history)).toBe(true);
  });

  it("write only the details that are set", () => {
    expect(encodeTodo({ text: "Task", done: false, position: "a0", createdAt: 1, updatedAt: 2, ...EMPTY_FIELDS })).toStrictEqual({ t: "Task", d: 0, p: "a0", c: 1, u: 2 });
    expect(encodeTodo({ text: "Task", done: true, position: "a0", createdAt: 1, updatedAt: 2 })).toStrictEqual({ t: "Task", d: 1, p: "a0", c: 1, u: 2 });
  });

  it("keep lists and repeats up to their length limits", () => {
    const list = "l".repeat(24);
    const repeat = "r".repeat(24);

    expect(decodeFields({ ...RECORD, l: list, r: repeat })).toMatchObject({ list, repeat });
    expect(decodeFields({ ...RECORD, l: `${list}x`, r: `${repeat}x` })).toMatchObject({ list: null, repeat: null });
    expect(decodeFields({ ...RECORD, l: "", r: "" })).toMatchObject({ list: null, repeat: null });
  });

  it("know every field they write, and keep the rest as extras", () => {
    const todo = decodeTodo("a", { ...RECORD, k: 1, l: "work01", w: "2026-11-21", r: "1d", s: { u: "https://a.test/" }, y: "2026-11-21", x: 5, z: "future" } as never, "device");

    expect(todo.extra).toEqual({ z: "future" });
  });

  it("check every required field", () => {
    expect(isTodoRecord(RECORD)).toBe(true);

    for (const broken of [{ ...RECORD, t: 5 }, { ...RECORD, d: 2 }, { ...RECORD, p: 5 }, { ...RECORD, p: "" }, { ...RECORD, c: "1" }, { ...RECORD, u: "2" }, { ...RECORD, k: 0 }, null, "record"]) {
      expect(isTodoRecord(broken), JSON.stringify(broken)).toBe(false);
    }
  });

  it("sort by position first, whatever the creation time", () => {
    expect(compareTodos({ id: "b", position: "a0", createdAt: 9 }, { id: "a", position: "a1", createdAt: 1 })).toBe(-1);
    expect(compareTodos({ id: "a", position: "a1", createdAt: 1 }, { id: "b", position: "a0", createdAt: 9 })).toBe(1);
  });
});

describe("page links", () => {
  it("keep http(s) pages only", () => {
    expect(sanitizeSource("https://example.com/a?b=1#c", "  A   page ")).toEqual({ url: "https://example.com/a?b=1#c", title: "A page" });
    expect(sanitizeSource("http://example.com", 5)).toEqual({ url: "http://example.com/", title: null });
    expect(sanitizeSource("https://example.com", "   ")).toEqual({ url: "https://example.com/", title: null });

    for (const url of ["javascript:alert(1)", "data:text/html,x", "chrome://settings", "file:///etc/passwd", "not a url", 5, null, undefined]) {
      expect(sanitizeSource(url, "x"), String(url)).toBeNull();
    }

    // Only real strings: an object that turns into a URL isn't a page link.
    expect(sanitizeSource({ toString: () => "https://example.com" })).toBeNull();
  });

  it("drop the query of long URLs, then cut them", () => {
    const base = "https://example.com/";
    const atLimit = `${base}?q=${"a".repeat(MAX_SOURCE_URL_LENGTH - base.length - 3)}`;

    expect(atLimit).toHaveLength(MAX_SOURCE_URL_LENGTH);
    expect(sanitizeSource(atLimit)?.url).toBe(atLimit);
    expect(sanitizeSource(`${atLimit}a#top`)?.url).toBe(base);

    const longPath = `${base}${"p".repeat(500)}?q=1`;

    expect(sanitizeSource(longPath)?.url).toBe(longPath.slice(0, MAX_SOURCE_URL_LENGTH));
  });

  it("cut long titles", () => {
    expect(sanitizeSource("https://a.test", "t".repeat(200))?.title).toBe("t".repeat(120));
  });
});

describe("text", () => {
  it("cuts at the limit without leaving a space or half an emoji", () => {
    const max = TODO_LIMITS.maxTextLength;

    expect(normalizeText(`${"a".repeat(max - 1)} b`)).toBe("a".repeat(max - 1));
    expect(normalizeText(`${"a".repeat(max - 1)}😀`)).toBe("a".repeat(max - 1));
    expect(normalizeText(`${"a".repeat(max - 2)}😀`)).toBe(`${"a".repeat(max - 2)}😀`);
    expect(normalizeText("hi 😀 there")).toBe("hi 😀 there");
    expect(normalizeText(`😀 ${"a".repeat(max)}`)).toHaveLength(max);
  });
});

describe("trash records", () => {
  it("use x: keys with an ID", () => {
    expect(idFromTrashKey("x:abc")).toBe("abc");
    expect(idFromTrashKey("x:")).toBeNull();
    expect(idFromTrashKey("t:abc")).toBeNull();
  });

  it("need a to-do record with a deletion time", () => {
    expect(isTrashRecord({ ...RECORD, x: 5 })).toBe(true);
    expect(isTrashRecord(RECORD)).toBe(false);
    expect(isTrashRecord({ ...RECORD, x: "5" })).toBe(false);
    expect(isTrashRecord({ x: 5 })).toBe(false);
  });

  it("are read only from trash keys with valid records", () => {
    const trash = readTrash({ "x:a": { ...RECORD, x: 5 }, "t:b": { ...RECORD, x: 5 }, "x:c": { x: 5 }, "x:": { ...RECORD, x: 5 } });

    expect([...trash.keys()]).toEqual(["a"]);
  });

  it("restore to where they were kept", () => {
    expect(decodeTrashed("a", { ...RECORD, x: 5, k: 1 })).toMatchObject({ location: "device", keepOnDevice: true, deletedAt: 5 });
    expect(decodeTrashed("a", { ...RECORD, x: 5 })).toMatchObject({ location: "sync", keepOnDevice: false });
  });
});

describe("review fixes", () => {
  it("lists accept only short lowercase IDs that aren't built-in views", () => {
    const lists = parseLists([
      { i: "work01", n: "Work" },
      { i: "today", n: "Clash" },
      { i: "all", n: "Clash" },
      { i: "inbox", n: "Clash" },
      { i: "UPPER", n: "Bad" },
      { i: "x".repeat(25), n: "Long" },
      { i: "y".repeat(24), n: "Longest" },
      { i: "", n: "Empty" },
    ]);

    expect(lists.map(list => list.id)).toEqual(["work01", "y".repeat(24)]);
  });

  it("lists keep fields a newer version wrote", () => {
    const [list] = parseLists([{ i: "work01", n: "Work", e: "💼", color: "red" }]);

    expect(list).toEqual({ id: "work01", name: "Work", emoji: "💼", extra: { color: "red" } });
    expect(encodeLists([{ ...list!, name: "Job" }])).toEqual([{ color: "red", i: "work01", n: "Job", e: "💼" }]);
    expect(parseLists([{ i: "home01", n: "Home" }])[0]).not.toHaveProperty("extra");
  });

  it("list emoji stay short", () => {
    expect(normalizeEmoji("👨‍👩‍👧‍👦 family")).toBe("👨‍👩‍👧‍👦");
    expect(normalizeEmoji(`a${"\u0301".repeat(40)}`)).toBeNull();
  });

  it("backups drop positions that can't be ordered", () => {
    const todos = ["a0", "z", "1", "a10", "A0", "Zz", "a0V"].map((position, index) => ({ id: `t${index}`, text: "x", position }));
    const preview = parseBackup(JSON.stringify({ app: "swift-todo", version: 1, todos }));

    expect(preview.data.todos.map(todo => todo.position)).toEqual(["a0", "Zz", "a0V"]);
    expect(isOrderKey("a0")).toBe(true);
    expect(isOrderKey("a10")).toBe(false);
  });

  it("markdown escapes list names too", () => {
    const todo = { id: "a", text: "x", done: false, list: "l1", due: null, repeat: null, source: null } as never;

    expect(toMarkdown([todo], [{ id: "l1", name: "<img src=x>", emoji: null }], "Inbox")).toBe("## \\<img src=x\\>\n\n- [ ] x\n");
  });
});
