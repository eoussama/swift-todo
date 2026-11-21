import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PREFS, mergePrefs, parsePrefs } from "~/lib/prefs/prefs";
import { DEFAULT_SYNC_LIMITS } from "~/lib/todos/limits";
import { createListId, encodeLists, MAX_LISTS, normalizeEmoji, normalizeListName, parseLists } from "~/lib/todos/lists";
import { decodeFields, decodeTodo, encodeTodo, isDate, isDue, MAX_SOURCE_URL_LENGTH, sanitizeSource } from "~/lib/todos/model";

import { createDevice, texts } from "./helpers";



beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
});

const base = { text: "Task", done: false, position: "a0", createdAt: 1, updatedAt: 2 };

describe("to-do fields", () => {
  it("writes optional fields only when set, and reads them back", () => {
    expect(encodeTodo(base)).toEqual({ t: "Task", d: 0, p: "a0", c: 1, u: 2 });

    const record = encodeTodo({
      ...base,
      list: "abc123",
      due: "2026-11-24T15:00",
      repeat: "1d",
      source: { url: "https://example.com/a", title: "Example" },
      today: "2026-11-21",
    });

    expect(record).toEqual({
      t: "Task",
      d: 0,
      p: "a0",
      c: 1,
      u: 2,
      l: "abc123",
      w: "2026-11-24T15:00",
      r: "1d",
      s: { u: "https://example.com/a", t: "Example" },
      y: "2026-11-21",
    });
    expect(decodeTodo("x", record, "sync")).toMatchObject({
      list: "abc123",
      due: "2026-11-24T15:00",
      repeat: "1d",
      source: { url: "https://example.com/a", title: "Example" },
      today: "2026-11-21",
    });
    expect(encodeTodo({ ...base, source: { url: "https://example.com/", title: null } }).s).toEqual({ u: "https://example.com/" });
  });

  it("drops malformed optional fields instead of the whole to-do", () => {
    expect(decodeFields({ t: "x", d: 0, p: "a0", c: 1, u: 1, l: "", w: "tomorrow", r: "", s: { u: "javascript:alert(1)" }, y: "2026-13-01" } as never)).toEqual({
      list: null,
      due: null,
      repeat: null,
      source: null,
      today: null,
      history: [],
      hidden: false,
      pinned: false,
    });
    expect(decodeFields({ t: "x", d: 0, p: "a0", c: 1, u: 1, l: "x".repeat(25), r: "x".repeat(25), s: "nope" } as never)).toMatchObject({ list: null, repeat: null, source: null });
  });

  it("keeps fields it doesn't know, so older versions never wipe newer data", () => {
    const fromNewerVersion = { t: "Task", d: 0, p: "a0", c: 1, u: 2, z: { future: true }, q: 7 };
    const todo = decodeTodo("x", fromNewerVersion as never, "sync");

    expect(todo.extra).toEqual({ z: { future: true }, q: 7 });
    expect(encodeTodo({ ...todo, text: "Edited" })).toMatchObject({ t: "Edited", z: { future: true }, q: 7 });
  });

  it("validates due values and dates", () => {
    expect(isDue("2026-02-28")).toBe(true);
    expect(isDue("2026-02-28T23:59")).toBe(true);
    expect(isDue("2026-02-28T24:00")).toBe(false);
    expect(isDue("2026-00-10")).toBe(false);
    expect(isDue(20261124)).toBe(false);
    expect(isDate("2026-11-21")).toBe(true);
    expect(isDate("2026-11-21T10:00")).toBe(false);
  });
});

describe("sanitizeSource", () => {
  it("keeps web pages only", () => {
    expect(sanitizeSource("https://example.com/page", "  A   page ")).toEqual({ url: "https://example.com/page", title: "A page" });
    expect(sanitizeSource("http://example.com", "")).toEqual({ url: "http://example.com/", title: null });
    expect(sanitizeSource("javascript:alert(1)")).toBeNull();
    expect(sanitizeSource("file:///etc/passwd")).toBeNull();
    expect(sanitizeSource("not a url")).toBeNull();
    expect(sanitizeSource(42)).toBeNull();
  });

  it("shortens long URLs and titles", () => {
    const long = `https://example.com/path?${"q=1&".repeat(200)}#frag`;
    const source = sanitizeSource(long, "t".repeat(300))!;

    expect(source.url).toBe("https://example.com/path");
    expect(source.title).toHaveLength(120);

    const longPath = sanitizeSource(`https://example.com/${"p".repeat(600)}`)!;

    expect(longPath.url).toHaveLength(MAX_SOURCE_URL_LENGTH);
  });
});

describe("lists", () => {
  it("parses stored lists, skipping bad and duplicate entries", () => {
    expect(parseLists("nope")).toEqual([]);
    expect(parseLists([
      { i: "a", n: " Work   stuff ", e: "💼 extra" },
      { i: "a", n: "Duplicate" },
      { i: "b", n: "   " },
      { i: "", n: "No id" },
      { n: "No id either" },
      null,
      { i: "c", n: "Home" },
    ])).toEqual([
      { id: "a", name: "Work stuff", emoji: "💼" },
      { id: "c", name: "Home", emoji: null },
    ]);
  });

  it("caps the number of lists and the name length", () => {
    const many = Array.from({ length: MAX_LISTS + 5 }, (_, i) => ({ i: `l${i}`, n: `List ${i}` }));

    expect(parseLists(many)).toHaveLength(MAX_LISTS);
    expect(normalizeListName("x".repeat(80))).toHaveLength(32);
  });

  it("encodes lists compactly", () => {
    expect(encodeLists([{ id: "a", name: "Work", emoji: null }, { id: "b", name: "Fun", emoji: "🎉" }])).toEqual([
      { i: "a", n: "Work" },
      { i: "b", n: "Fun", e: "🎉" },
    ]);
    expect(createListId()).toMatch(/^[0-9a-z]{6}$/);
  });

  it("keeps a single emoji", () => {
    expect(normalizeEmoji("👩‍💻 dev")).toBe("👩‍💻");
    expect(normalizeEmoji("  ")).toBeNull();
    expect(normalizeEmoji(null)).toBeNull();
    expect(normalizeEmoji(undefined)).toBeNull();
  });
});

describe("prefs", () => {
  it("falls back to the defaults for anything missing or malformed", () => {
    expect(parsePrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs({ skin: "neon", accent: 3, theme: "dark", reminders: "yes", lead: 7.5, digest: "25:00", nudges: true, badge: "open", timer: 0 })).toEqual({
      ...DEFAULT_PREFS,
      theme: "dark",
      nudges: true,
      badge: "open",
    });
    expect(parsePrefs({ skin: "chalk", lead: 15, digest: "08:30", timer: 50, reminders: true })).toMatchObject({ skin: "chalk", lead: 15, digest: "08:30", timer: 50, reminders: true });
  });

  it("keeps settings from newer versions when saving", () => {
    expect(mergePrefs({ future: 1, skin: "notepad" }, { skin: "minimal" })).toMatchObject({ future: 1, skin: "minimal" });
    expect(mergePrefs("garbage", { theme: "light" })).toMatchObject({ theme: "light", skin: "notepad" });
  });
});

describe("repository documents", () => {
  it("adds to-dos with details, and several at once in order", async () => {
    const device = createDevice();

    await device.repository.add("Plain");
    await device.repository.addMany([
      { text: "Due", fields: { due: "2026-11-24", list: "work01" } },
      { text: "Repeats", fields: { repeat: "1d" } },
    ]);

    const { todos } = await device.repository.load();

    expect(todos.map(todo => todo.text)).toEqual(["Plain", "Due", "Repeats"]);
    expect(todos[1]).toMatchObject({ due: "2026-11-24", list: "work01" });
    await expect(device.repository.addMany([])).rejects.toMatchObject({ code: "empty" });
    await expect(device.repository.addMany([{ text: "ok" }, { text: " " }])).rejects.toMatchObject({ code: "empty" });
  });

  it("updates and clears details", async () => {
    const device = createDevice();
    const todo = await device.repository.add("Task", { due: "2026-11-24", repeat: "1w" });

    await device.repository.update(todo.id, { due: null, list: "home01", today: "2026-11-21" });

    const [updated] = (await device.repository.load()).todos;

    expect(updated).toMatchObject({ due: null, repeat: "1w", list: "home01", today: "2026-11-21" });

    const set = vi.spyOn(device.local, "set");

    await device.repository.update(todo.id, { list: "home01" });
    expect(set).not.toHaveBeenCalled();
  });

  it("saves lists and settings, synced like to-dos", async () => {
    const device = createDevice();

    await device.repository.saveLists([{ id: "work01", name: "Work", emoji: "💼" }]);
    await device.repository.savePrefs({ skin: "chalk" });

    let snapshot = await device.repository.load();

    expect(snapshot.lists).toEqual([{ id: "work01", name: "Work", emoji: "💼" }]);
    expect(snapshot.prefs.skin).toBe("chalk");
    expect(snapshot.status.pending).toBe(2);

    await device.repository.flush();
    snapshot = await device.repository.load();

    expect(snapshot.status.pending).toBe(0);
    expect(device.sync.data.get("lists")).toEqual([{ i: "work01", n: "Work", e: "💼" }]);
    expect(device.sync.data.get("prefs")).toMatchObject({ skin: "chalk" });

    // Another device sees them.
    const phone = createDevice({ sync: device.sync });

    expect((await phone.repository.load()).lists).toHaveLength(1);
  });

  it("counts pending documents in the sync usage", async () => {
    const device = createDevice();
    const before = (await device.repository.load()).status.usage.bytes;

    await device.repository.saveLists([{ id: "work01", name: "Work", emoji: null }]);
    expect((await device.repository.load()).status.usage.bytes).toBeGreaterThan(before);

    await device.repository.flush();
    await device.repository.saveLists([{ id: "work01", name: "Work, renamed", emoji: null }]);

    const { usage } = (await device.repository.load()).status;

    expect(usage.items).toBe(2);
  });

  it("keeps documents on the device when sync is off", async () => {
    const device = createDevice({ noSync: true });

    await device.repository.savePrefs({ accent: "coral" });
    await device.repository.flush();

    expect(device.local.data.get("prefs")).toMatchObject({ accent: "coral" });
    expect((await device.repository.load()).prefs.accent).toBe("coral");
  });

  it("moves pending documents to the device when sync turns out to be unavailable", async () => {
    const device = createDevice();

    await device.repository.saveLists([{ id: "a", name: "A", emoji: null }]);
    vi.spyOn(device.sync, "set").mockRejectedValueOnce(new Error("storage.sync is not supported"));
    await device.repository.flush();

    expect(device.local.data.get("lists")).toEqual([{ i: "a", n: "A" }]);
  });

  it("deletes a list and moves its to-dos to the Inbox", async () => {
    const device = createDevice();

    await device.repository.saveLists([{ id: "work01", name: "Work", emoji: null }, { id: "home01", name: "Home", emoji: null }]);
    await device.repository.add("In work", { list: "work01" });
    await device.repository.add("In home", { list: "home01" });
    await device.repository.deleteList("work01");

    const { lists, todos } = await device.repository.load();

    expect(lists.map(list => list.id)).toEqual(["home01"]);
    expect(todos.map(todo => [todo.text, todo.list])).toEqual([["In work", null], ["In home", "home01"]]);
  });

  it("ignores malformed outbox entries", async () => {
    const device = createDevice();

    await device.local.set({ outbox: { "@nope": { op: "doc", value: 1 }, "@lists": { op: "put" }, "abc": { op: "doc", value: 1 }, "def": "bad" } });

    expect((await device.repository.load()).status.pending).toBe(0);
  });

  it("refreshes subscribers when documents change", async () => {
    const device = createDevice();
    const listener = vi.fn();

    device.repository.subscribe(listener);
    await device.repository.flush();
    await device.sync.set({ prefs: { skin: "minimal" } });

    expect(listener).toHaveBeenCalledWith("sync");
  });
});

describe("import", () => {
  const backupTodo = (id: string, text: string, extra = {}) => ({
    ...decodeTodo(id, encodeTodo({ ...base, text, position: `a${id.length}` }), "sync"),
    ...extra,
  });

  it("merges: adds new to-dos and lists, skips ones already here", async () => {
    const device = createDevice();
    const own = await device.repository.add("Mine");

    await device.repository.saveLists([{ id: "work01", name: "Work", emoji: null }]);

    const result = await device.repository.importData({
      todos: [backupTodo(own.id, "Mine, older"), backupTodo("imported01", "From backup", { list: "fun001" })],
      lists: [{ id: "work01", name: "Work (backup)", emoji: null }, { id: "fun001", name: "Fun", emoji: null }],
      prefs: { ...DEFAULT_PREFS, skin: "chalk" },
    }, "merge");

    expect(result).toEqual({ added: 1, skipped: 1, trashed: 0 });

    const snapshot = await device.repository.load();

    expect(snapshot.todos.map(todo => todo.text).sort()).toEqual(["From backup", "Mine"]);
    expect(snapshot.lists.map(list => list.name)).toEqual(["Work", "Fun"]);
    expect(snapshot.prefs.skin).toBe("notepad");
  });

  it("replaces: trashes current to-dos and takes the backup's lists and settings", async () => {
    const device = createDevice();

    await device.repository.add("Old");

    const result = await device.repository.importData({
      todos: [backupTodo("imported01", "New"), backupTodo("kept000001", "Kept", { keepOnDevice: true })],
      lists: [{ id: "fun001", name: "Fun", emoji: null }],
      prefs: { ...DEFAULT_PREFS, skin: "scroll" },
    }, "replace");

    expect(result).toEqual({ added: 2, skipped: 0, trashed: 1 });

    const snapshot = await device.repository.load();

    expect(snapshot.todos.map(todo => todo.text).sort()).toEqual(["Kept", "New"]);
    expect(snapshot.todos.find(todo => todo.text === "Kept")).toMatchObject({ location: "device", keepOnDevice: true });
    expect(snapshot.trash.map(todo => todo.text)).toEqual(["Old"]);
    expect(snapshot.lists.map(list => list.id)).toEqual(["fun001"]);
    expect(snapshot.prefs.skin).toBe("scroll");
    expect(await texts(device)).toHaveLength(2);
  });

  it("replaces without touching settings when the backup has none", async () => {
    const device = createDevice({ limits: DEFAULT_SYNC_LIMITS });

    await device.repository.savePrefs({ skin: "chalk" });
    await device.repository.importData({ todos: [], lists: [], prefs: null }, "replace");

    expect((await device.repository.load()).prefs.skin).toBe("chalk");
  });
});
