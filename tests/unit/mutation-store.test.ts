import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PREFS } from "~/lib/prefs/prefs";
import { DEFAULT_SYNC_LIMITS } from "~/lib/todos/limits";
import { TodoStore } from "~/lib/todos/todos.svelte";

import { createDevice } from "./helpers";



beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
});

// Tells the store's subscription that storage changed in an area.
function emit(device: ReturnType<typeof createDevice>, area: string): void {
  for (const listener of device.listeners) {
    listener({ "t:zzz": {} }, area);
  }
}

describe("todo store details", () => {
  it("starts empty, with default settings and the full sync quota", () => {
    const store = new TodoStore(createDevice().repository);

    expect(store.todos).toEqual([]);
    expect(store.trash).toEqual([]);
    expect(store.lists).toEqual([]);
    expect(store.prefs).toEqual(DEFAULT_PREFS);
    expect(store.ready).toBe(false);
    expect(store.filter).toBe("all");
    expect(store.status).toEqual({
      mode: "sync",
      pending: 0,
      synced: 0,
      deviceOnly: 0,
      keptOnDevice: 0,
      usage: { bytes: 0, quotaBytes: DEFAULT_SYNC_LIMITS.quotaBytes, items: 0, maxItems: DEFAULT_SYNC_LIMITS.maxItems, ratio: 0 },
      retryAt: null,
    });
  });

  it("restores only a saved filter, and remembers new ones", async () => {
    const saveFilter = vi.fn(async () => {});
    const none = new TodoStore(createDevice().repository, { ui: { loadFilter: async () => null, saveFilter } });

    await none.start();
    expect(none.filter).toBe("all");

    const saved = new TodoStore(createDevice().repository, { ui: { loadFilter: async () => "inbox", saveFilter } });

    await saved.start();
    expect(saved.filter).toBe("inbox");

    await saved.setFilter("today");
    expect(saveFilter).toHaveBeenCalledWith("today");
  });

  it("tries to free device-only to-dos only when sync changes and some are waiting", async () => {
    const device = createDevice();
    const store = new TodoStore(device.repository);
    const flush = vi.spyOn(device.repository, "flush");

    await store.start();
    flush.mockClear();

    emit(device, "local");
    emit(device, "sync");
    expect(flush).not.toHaveBeenCalled();

    store.status = { ...store.status, deviceOnly: 1 };
    emit(device, "local");
    expect(flush).not.toHaveBeenCalled();
    emit(device, "sync");
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("reloads once after a burst of changes, and stops following them", async () => {
    const device = createDevice();
    const store = new TodoStore(device.repository);
    const load = vi.spyOn(device.repository, "load");
    const stop = await store.start();

    // Let the flush that starting kicks off settle first.
    await vi.advanceTimersByTimeAsync(2_000);
    load.mockClear();
    emit(device, "local");
    await vi.advanceTimersByTimeAsync(10);
    emit(device, "local");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(load).toHaveBeenCalledTimes(1);

    load.mockClear();
    emit(device, "local");
    stop();
    await vi.advanceTimersByTimeAsync(1_000);
    emit(device, "local");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(load).not.toHaveBeenCalled();
  });

  it("updates to-dos, and unchecks done ones", async () => {
    const store = new TodoStore(createDevice().repository);

    await store.start();

    const todo = await store.add("Read");

    await store.update(todo!.id, { text: "Read a book" });
    expect(store.todos[0]).toMatchObject({ text: "Read a book", done: false });

    expect(await store.toggle(todo!.id)).toBeNull();
    expect(store.todos[0]?.done).toBe(true);
    expect(await store.toggle(todo!.id)).toBeNull();
    expect(store.todos[0]?.done).toBe(false);
    expect(await store.toggle("missing")).toBeUndefined();
  });

  it("moves repeating to-dos on from its own clock", async () => {
    const store = new TodoStore(createDevice().repository, { now: () => new Date(2030, 0, 10, 10, 30) });

    await store.start();

    const todo = await store.add("Water plants", { due: "2026-11-21", repeat: "1d" });

    expect(await store.toggle(todo!.id)).toBe("2030-01-11");
  });

  it("keeps lists in place, without saving, when moved past either end", async () => {
    const device = createDevice();
    const store = new TodoStore(device.repository);

    await store.start();
    await store.addList("One");
    await store.addList("Two");
    await store.addList("Three");

    const names = (): Array<string> => store.lists.map(list => list.name);
    const [first, , last] = store.lists;
    const save = vi.spyOn(device.repository, "saveLists");

    await store.moveList(first!.id, -1);
    await store.moveList(last!.id, 1);
    await store.moveList("missing", 1);
    expect(names()).toEqual(["One", "Two", "Three"]);
    expect(save).not.toHaveBeenCalled();

    await store.moveList(first!.id, 1);
    expect(names()).toEqual(["Two", "One", "Three"]);
  });

  it("ignores restoring something that isn't in the trash", async () => {
    const store = new TodoStore(createDevice().repository);

    await store.start();
    await store.restoreFromTrash("missing");
    expect(store.error).toBeNull();
    expect(store.todos).toEqual([]);
  });
});
