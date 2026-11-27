import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SUB_GRACE_MS, SubMenu } from "~/lib/components/sub-menu.svelte";
import { DEFAULT_PREFS, mergePrefs, parsePrefs } from "~/lib/prefs/prefs";
import { DEFAULT_SORT, parseSorts, SORTS, sortTodos, withSort } from "~/lib/todos/sort";
import { TodoStore } from "~/lib/todos/todos.svelte";

import { createDevice } from "./helpers";



type TItem = { id: string; text: string; createdAt: number; due: string | null };

const item = (id: string, text: string, createdAt: number, due: string | null = null): TItem => ({ id, text, createdAt, due });
const ids = (todos: ReadonlyArray<TItem>): Array<string> => todos.map(todo => todo.id);

describe("sortTodos", () => {
  // In their order by hand: c was dragged above a and b.
  const todos = [
    item("c", "item 10", 3, "2026-12-01T09:00"),
    item("a", "Banana", 1, "2026-12-01"),
    item("b", "apple", 2),
    item("d", "item 9", 2, "2026-11-30T18:00"),
  ];

  it("keeps the order by hand, as a copy", () => {
    const sorted = sortTodos(todos, "manual");

    expect(ids(sorted)).toEqual(["c", "a", "b", "d"]);
    expect(sorted).not.toBe(todos);
  });

  it("sorts by when they were added, ties keeping their order by hand", () => {
    expect(ids(sortTodos(todos, "newest"))).toEqual(["c", "b", "d", "a"]);
    expect(ids(sortTodos(todos, "oldest"))).toEqual(["a", "b", "d", "c"]);
  });

  it("sorts by due date, soonest first, a date alone before a time that day, undated last", () => {
    expect(ids(sortTodos(todos, "due"))).toEqual(["d", "a", "c", "b"]);
    expect(ids(sortTodos([item("x", "", 1), item("y", "", 2), item("z", "", 3, "2026-01-01")], "due"))).toEqual(["z", "x", "y"]);
    expect(ids(sortTodos([item("x", "", 1, "2026-01-01"), item("y", "", 2, "2026-01-01")], "due"))).toEqual(["x", "y"]);
    expect(ids(sortTodos([item("late", "", 1, "2026-02-01"), item("early", "", 2, "2026-01-01")], "due"))).toEqual(["early", "late"]);
    expect(ids(sortTodos([item("early", "", 1, "2026-01-01"), item("late", "", 2, "2026-02-01")], "due"))).toEqual(["early", "late"]);
  });

  it("sorts by name, ignoring case and reading numbers as numbers", () => {
    expect(ids(sortTodos(todos, "alpha"))).toEqual(["b", "a", "d", "c"]);
  });

  it("leaves what it's given alone", () => {
    const before = ids(todos);

    for (const sort of SORTS) {
      sortTodos(todos, sort);
    }

    expect(ids(todos)).toEqual(before);
  });
});

describe("parseSorts", () => {
  it("keeps known sorts other than by hand, and drops the rest", () => {
    expect(parseSorts({ all: "due", inbox: "manual", home01: "alpha", work: "sideways", x: 3 })).toEqual({ all: "due", home01: "alpha" });
    expect(parseSorts(null)).toEqual({});
    expect(parseSorts(["due"])).toEqual({});
  });

  it("keeps no more than there could be lists and views", () => {
    const many = Object.fromEntries(Array.from({ length: 40 }, (_, index) => [`l${index}`, "newest"]));

    expect(Object.keys(parseSorts(many))).toHaveLength(32);
  });
});

describe("withSort", () => {
  const keep = (id: string): boolean => id !== "gone";

  it("sets one list's sort, keeping the others", () => {
    expect(withSort({ all: "due" }, "home01", "alpha", keep)).toEqual({ all: "due", home01: "alpha" });
    expect(withSort({ all: "due" }, "all", "newest", keep)).toEqual({ all: "newest" });
  });

  it("drops a list going back to by hand, and lists that are gone", () => {
    expect(withSort({ all: "due", gone: "alpha" }, "all", DEFAULT_SORT, keep)).toEqual({});
    expect(withSort({ gone: "alpha" }, "inbox", "oldest", keep)).toEqual({ inbox: "oldest" });
  });
});

describe("sorts in settings", () => {
  it("start empty, and are read and written like any other setting", () => {
    expect(DEFAULT_PREFS.sorts).toEqual({});
    expect(parsePrefs({ sorts: { all: "due", inbox: "nope" } }).sorts).toEqual({ all: "due" });
    expect(parsePrefs({ sorts: "due" }).sorts).toEqual({});
    expect(mergePrefs({ skin: "chalk", future: 1 }, { sorts: { all: "alpha" } })).toEqual({ skin: "chalk", future: 1, sorts: { all: "alpha" } });
  });
});

describe("subMenu", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("closes a moment after the pointer leaves its item and the submenu", () => {
    const sub = new SubMenu();

    sub.open = true;
    sub.trigger.onpointerenter();
    sub.trigger.onpointerleave();
    vi.advanceTimersByTime(SUB_GRACE_MS - 1);
    expect(sub.open).toBe(true);

    vi.advanceTimersByTime(1);
    expect(sub.open).toBe(false);
  });

  it("stays open while the pointer crosses over to the submenu, or back", () => {
    const sub = new SubMenu();

    sub.open = true;
    sub.trigger.onpointerenter();
    sub.trigger.onpointerleave();
    sub.content.onpointerenter();
    vi.advanceTimersByTime(SUB_GRACE_MS * 2);
    expect(sub.open).toBe(true);

    sub.content.onpointerleave();
    sub.trigger.onpointerenter();
    vi.advanceTimersByTime(SUB_GRACE_MS * 2);
    expect(sub.open).toBe(true);

    // Leaving the submenu for nowhere closes it.
    sub.trigger.onpointerleave();
    sub.content.onpointerenter();
    sub.content.onpointerleave();
    vi.advanceTimersByTime(SUB_GRACE_MS);
    expect(sub.open).toBe(false);
  });

  it("waits only from the last time the pointer left, and stops waiting when it goes away", () => {
    const sub = new SubMenu();

    sub.open = true;
    sub.trigger.onpointerleave();
    vi.advanceTimersByTime(SUB_GRACE_MS - 50);
    sub.content.onpointerleave();
    vi.advanceTimersByTime(SUB_GRACE_MS - 1);
    expect(sub.open).toBe(true);

    sub.dispose();
    vi.advanceTimersByTime(SUB_GRACE_MS);
    expect(sub.open).toBe(true);
  });
});

describe("todoStore sorts", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sorts each list on its own, by hand until told otherwise, on every device", async () => {
    const device = createDevice();
    const store = new TodoStore(device.repository);

    await store.start();

    const home = await store.addList("Home");

    expect(store.sort).toBe("manual");
    expect(store.sortOf(home!.id)).toBe("manual");

    await store.setSort("all", "due");
    await store.setSort(home!.id, "alpha");

    expect(store.sort).toBe("due");
    expect(store.sortOf(home!.id)).toBe("alpha");
    expect(store.sortOf("inbox")).toBe("manual");

    // Sorting another keeps the lists still there.
    await store.setSort("inbox", "oldest");
    expect(store.sortOf(home!.id)).toBe("alpha");
    await store.setSort("inbox", "manual");

    await store.setFilter(home!.id);
    expect(store.sort).toBe("alpha");

    // Synced, like the rest of the settings.
    await device.repository.flush();

    const phone = createDevice({ sync: device.sync });

    expect((await phone.repository.load()).prefs.sorts).toEqual({ all: "due", [home!.id]: "alpha" });
  });

  it("writes nothing when the sort doesn't change, and forgets deleted lists", async () => {
    const device = createDevice();
    const store = new TodoStore(device.repository);

    await store.start();

    const home = await store.addList("Home");

    await store.setSort(home!.id, "newest");
    await store.deleteList(home!.id);

    const save = vi.spyOn(device.repository, "savePrefs");

    await store.setSort("all", "manual");
    expect(save).not.toHaveBeenCalled();

    await store.setSort("today", "due");
    expect(store.prefs.sorts).toEqual({ today: "due" });
  });
});
