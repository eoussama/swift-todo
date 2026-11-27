import type { TTodo } from "~/lib/todos/model";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TodoError } from "~/lib/todos/errors";
import { DEFAULT_SYNC_LIMITS, FLUSH_ALARM } from "~/lib/todos/limits";

import { encodeTodo } from "~/lib/todos/model";

import { createDevice, memoryArea, texts } from "./helpers";



beforeEach(() => {
  // Keep the repository's own flush timers from firing; tests flush explicitly.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("basic operations", () => {
  it("adds to-dos at the end and keeps them pending until flushed", async () => {
    const device = createDevice();

    await device.repository.add("First");
    await device.repository.add("  Second\n");

    let snapshot = await device.repository.load();

    expect(snapshot.todos.map(todo => todo.text)).toEqual(["First", "Second"]);
    expect(snapshot.todos.every(todo => todo.pending && todo.location === "sync")).toBe(true);
    expect(snapshot.status.pending).toBe(2);
    expect(device.alarms.create).toHaveBeenCalledWith(FLUSH_ALARM, expect.anything());

    await device.repository.flush();
    snapshot = await device.repository.load();

    expect(snapshot.todos.some(todo => todo.pending)).toBe(false);
    expect(snapshot.status.pending).toBe(0);
    expect(device.sync.data.get("meta")).toEqual({ v: 2 });
    expect([...device.sync.data.keys()].filter(key => key.startsWith("t:"))).toHaveLength(2);
    expect(device.alarms.clear).toHaveBeenCalledWith(FLUSH_ALARM);
  });

  it("refuses empty text, but not a long list", async () => {
    const device = createDevice();

    await expect(device.repository.add("   ")).rejects.toThrow(TodoError);

    // More to-dos than sync could ever hold (512 keys) are fine; they live on the device.
    const records: Record<string, unknown> = {};

    for (let i = 0; i < 1_000; i++) {
      records[`t:${i.toString().padStart(4, "0")}`] = encodeTodo({ text: "x", done: false, position: `a${i}`, createdAt: i, updatedAt: i });
    }

    await device.local.set(records);
    await device.repository.add("one more");

    expect((await device.repository.load()).todos).toHaveLength(1_001);
  });

  it("updates text and done state, and ignores no-op updates", async () => {
    const device = createDevice();
    const todo = await device.repository.add("Draft");

    await device.repository.flush();
    await device.repository.update(todo.id, { text: "Final", done: true });

    const [updated] = (await device.repository.load()).todos;

    expect(updated).toMatchObject({ text: "Final", done: true, pending: true });

    await device.repository.flush();
    await device.repository.update(todo.id, { text: "Final" });
    expect((await device.repository.load()).status.pending).toBe(0);

    await expect(device.repository.update(todo.id, { text: " " })).rejects.toMatchObject({ code: "empty" });
    await expect(device.repository.update("missing", { done: true })).rejects.toMatchObject({ code: "not-found" });
  });

  it("removes a to-do and restores it in the same spot", async () => {
    const device = createDevice();

    await device.repository.add("A");
    const b = await device.repository.add("B");

    await device.repository.add("C");
    await device.repository.flush();

    const removed = await device.repository.remove(b.id);

    expect(await texts(device)).toEqual(["A", "C"]);

    await device.repository.flush();
    expect(device.sync.data.has(`t:${b.id}`)).toBe(false);

    await device.repository.restore([removed!]);
    expect(await texts(device)).toEqual(["A", "B", "C"]);
    expect(await device.repository.remove("missing")).toBeNull();
  });

  it("drops a pending to-do removed before it was ever synced, without a sync write", async () => {
    const device = createDevice();
    const todo = await device.repository.add("Oops");

    await device.repository.remove(todo.id);

    const remove = vi.spyOn(device.sync, "remove");

    await device.repository.flush();
    expect(remove).not.toHaveBeenCalled();
    expect(await texts(device)).toEqual([]);
  });

  it("reorders and clears completed to-dos", async () => {
    const device = createDevice();
    const a = await device.repository.add("A");

    await device.repository.add("B");
    const c = await device.repository.add("C");

    await device.repository.move(c.id, 0);
    expect(await texts(device)).toEqual(["C", "A", "B"]);

    await device.repository.update(a.id, { done: true });
    await device.repository.update(c.id, { done: true });

    const cleared = await device.repository.clearCompleted();

    expect(cleared.map(todo => todo.text)).toEqual(["C", "A"]);
    expect(await texts(device)).toEqual(["B"]);
  });

  it("moves the given to-dos to the trash, done or not, and skips ones already gone", async () => {
    const device = createDevice();
    const a = await device.repository.add("A");
    const b = await device.repository.add("B");

    await device.repository.add("C");
    await device.repository.update(b.id, { done: true });

    const removed = await device.repository.removeMany([b.id, a.id, "gone01"]);

    expect(removed.map(todo => todo.text)).toEqual(["A", "B"]);
    expect(await texts(device)).toEqual(["C"]);
    expect((await device.repository.load()).trash.map(todo => todo.text).sort()).toEqual(["A", "B"]);
  });
});

describe("write limits", () => {
  it("batches every pending change into one sync write", async () => {
    const device = createDevice();
    const set = vi.spyOn(device.sync, "set");

    for (const text of ["A", "B", "C", "D"]) {
      await device.repository.add(text);
    }

    await device.repository.flush();
    expect(set).toHaveBeenCalledTimes(1);
  });

  it("waits instead of writing when the rate budget is spent", async () => {
    const device = createDevice({ limits: { ...DEFAULT_SYNC_LIMITS, writesPerMinute: 2 } });
    const set = vi.spyOn(device.sync, "set");

    await device.repository.add("A");
    await device.repository.flush();
    await device.repository.add("B");
    await device.repository.flush();

    expect(set).toHaveBeenCalledTimes(1);

    const { status } = await device.repository.load();

    expect(status.pending).toBe(1);
    expect(status.retryAt).toBeGreaterThan(device.clock.now);

    device.clock.now += 61_000;
    await device.repository.flush();
    expect(set).toHaveBeenCalledTimes(2);
    expect((await device.repository.load()).status.pending).toBe(0);
  });

  it("keeps changes pending and retries when the browser reports a rate limit", async () => {
    const device = createDevice();

    await device.repository.add("A");
    vi.spyOn(device.sync, "set").mockRejectedValueOnce(new Error("MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await device.repository.flush();

    const { status, todos } = await device.repository.load();

    expect(status.pending).toBe(1);
    expect(status.retryAt).not.toBeNull();
    expect(todos[0]).toMatchObject({ text: "A", pending: true });
    expect(device.alarms.create).toHaveBeenLastCalledWith(FLUSH_ALARM, { delayInMinutes: 1 });

    await device.repository.flush();
    expect((await device.repository.load()).status).toMatchObject({ pending: 0, retryAt: null });
  });
});

describe("quota", () => {
  // Room for the meta key and roughly three small to-dos.
  const tiny = { ...DEFAULT_SYNC_LIMITS, quotaBytes: 260 };

  it("keeps new to-dos on the device when sync is nearly full", async () => {
    const device = createDevice({ limits: tiny });

    for (const text of ["one", "two", "three", "four", "five"]) {
      await device.repository.add(text);
      await device.repository.flush();
    }

    const { todos, status } = await device.repository.load();

    expect(todos.map(todo => todo.text)).toEqual(["one", "two", "three", "four", "five"]);
    expect(status.deviceOnly).toBeGreaterThan(0);
    expect(status.usage.bytes).toBeLessThanOrEqual(tiny.quotaBytes);
    expect(todos.at(-1)!.location).toBe("device");
  });

  it("moves device-only to-dos to sync once space frees up", async () => {
    const device = createDevice({ limits: tiny });
    const added: Array<TTodo> = [];

    for (const text of ["one", "two", "three", "four"]) {
      added.push(await device.repository.add(text));
      await device.repository.flush();
    }

    expect((await device.repository.load()).status.deviceOnly).toBeGreaterThan(0);

    await device.repository.remove(added[0]!.id);
    await device.repository.remove(added[1]!.id);
    await device.repository.flush();

    const { todos, status } = await device.repository.load();

    expect(todos.map(todo => todo.text)).toEqual(["three", "four"]);
    expect(status.deviceOnly).toBe(0);
    expect([...device.local.data.keys()].filter(key => key.startsWith("t:"))).toEqual([]);
  });

  it("moves an edited to-do to the device when it no longer fits", async () => {
    const device = createDevice({ limits: { ...DEFAULT_SYNC_LIMITS, quotaBytes: 200 } });
    const todo = await device.repository.add("short");

    await device.repository.flush();
    await device.repository.update(todo.id, { text: "x".repeat(400) });
    await device.repository.flush();

    const [stored] = (await device.repository.load()).todos;

    expect(stored).toMatchObject({ location: "device", text: "x".repeat(400) });
    expect(device.sync.data.has(`t:${todo.id}`)).toBe(false);
  });

  it("falls back to the device when the browser reports sync is full", async () => {
    const device = createDevice();

    await device.repository.add("A");
    vi.spyOn(device.sync, "set").mockRejectedValueOnce(new Error("QUOTA_BYTES quota exceeded"));

    await device.repository.flush();

    const { todos, status } = await device.repository.load();

    expect(todos).toMatchObject([{ text: "A", location: "device", pending: false }]);
    expect(status.pending).toBe(0);
  });
});

describe("choosing what syncs", () => {
  it("keeps a to-do on the device when sync is turned off for it, and frees its sync space", async () => {
    const device = createDevice();
    const todo = await device.repository.add("Private");

    await device.repository.flush();
    const before = (await device.repository.load()).status.usage.bytes;

    await device.repository.setSynced(todo.id, false);
    await device.repository.flush();

    const { todos, status } = await device.repository.load();

    expect(todos).toMatchObject([{ text: "Private", location: "device", keepOnDevice: true }]);
    expect(status).toMatchObject({ synced: 0, deviceOnly: 1, keptOnDevice: 1 });
    expect(status.usage.bytes).toBeLessThan(before);
    expect(device.sync.data.has(`t:${todo.id}`)).toBe(false);
  });

  it("never moves a kept to-do back to sync on its own, even through edits and moves", async () => {
    const device = createDevice();
    const kept = await device.repository.add("Kept");

    await device.repository.add("Other");
    await device.repository.setSynced(kept.id, false);
    await device.repository.update(kept.id, { text: "Kept, edited", done: true });
    await device.repository.move(kept.id, 1);
    await device.repository.flush();
    await device.repository.flush();

    const stored = (await device.repository.load()).todos.find(todo => todo.id === kept.id);

    expect(stored).toMatchObject({ text: "Kept, edited", done: true, location: "device", keepOnDevice: true });
  });

  it("moves a to-do back to sync when sync is turned on for it", async () => {
    const device = createDevice();
    const todo = await device.repository.add("Back");

    await device.repository.setSynced(todo.id, false);
    await device.repository.flush();
    await device.repository.setSynced(todo.id, true);

    expect((await device.repository.load()).todos[0]).toMatchObject({ location: "sync", keepOnDevice: false, pending: true });

    await device.repository.flush();

    expect(device.sync.data.has(`t:${todo.id}`)).toBe(true);
    expect(device.local.data.has(`t:${todo.id}`)).toBe(false);
  });

  it("refuses to sync a to-do that doesn't fit until another one is kept on the device", async () => {
    const device = createDevice({ limits: { ...DEFAULT_SYNC_LIMITS, quotaBytes: 260 } });
    const added: Array<TTodo> = [];

    for (const text of ["one", "two", "three", "four"]) {
      added.push(await device.repository.add(text));
      await device.repository.flush();
    }

    const waiting = (await device.repository.load()).todos.find(todo => todo.location === "device")!;

    expect(waiting.keepOnDevice).toBe(false);
    await expect(device.repository.setSynced(waiting.id, true)).rejects.toMatchObject({ code: "sync-full" });

    await device.repository.setSynced(added[0]!.id, false);
    await device.repository.setSynced(waiting.id, true);
    await device.repository.flush();

    const { todos } = await device.repository.load();

    expect(todos.find(todo => todo.id === waiting.id)!.location).toBe("sync");
    expect(todos.find(todo => todo.id === added[0]!.id)).toMatchObject({ location: "device", keepOnDevice: true });
  });

  it("refuses to sync anything when sync is unavailable", async () => {
    const device = createDevice({ noSync: true });
    const todo = await device.repository.add("A");

    await expect(device.repository.setSynced(todo.id, true)).rejects.toMatchObject({ code: "sync-unavailable" });

    await device.repository.setSynced(todo.id, false);
    expect((await device.repository.load()).todos[0]!.keepOnDevice).toBe(true);
  });

  it("ignores choices that change nothing", async () => {
    const device = createDevice();
    const todo = await device.repository.add("A");
    const set = vi.spyOn(device.local, "set");

    await device.repository.setSynced(todo.id, true);
    expect(set).not.toHaveBeenCalled();

    await device.repository.setSynced(todo.id, false);
    set.mockClear();
    await device.repository.setSynced(todo.id, false);
    expect(set).not.toHaveBeenCalled();
  });

  it("restores a kept to-do to the device", async () => {
    const device = createDevice();
    const todo = await device.repository.add("Kept");

    await device.repository.setSynced(todo.id, false);

    const removed = await device.repository.remove(todo.id);

    await device.repository.restore([removed!]);
    await device.repository.flush();

    expect((await device.repository.load()).todos).toMatchObject([{ location: "device", keepOnDevice: true }]);
  });
});

describe("trash", () => {
  it("keeps removed to-dos in the trash on this device only, newest first", async () => {
    const device = createDevice();
    const a = await device.repository.add("A");
    const b = await device.repository.add("B");

    await device.repository.flush();
    await device.repository.remove(a.id);
    device.clock.now += 1_000;
    await device.repository.remove(b.id);
    await device.repository.flush();

    const { todos, trash } = await device.repository.load();

    expect(todos).toEqual([]);
    expect(trash.map(todo => todo.text)).toEqual(["B", "A"]);
    expect(trash[0]!.deletedAt).toBe(device.clock.now);
    expect(device.local.data.has(`x:${a.id}`)).toBe(true);
    expect([...device.sync.data.keys()].some(key => key.startsWith("x:") || key === `t:${a.id}`)).toBe(false);
  });

  it("restores a trashed to-do to its spot and takes it out of the trash", async () => {
    const device = createDevice();

    await device.repository.add("A");
    const b = await device.repository.add("B");

    await device.repository.add("C");
    await device.repository.remove(b.id);

    const [trashed] = (await device.repository.load()).trash;

    await device.repository.restore([trashed!]);

    const { todos, trash } = await device.repository.load();

    expect(todos.map(todo => todo.text)).toEqual(["A", "B", "C"]);
    expect(trash).toEqual([]);
  });

  it("restores a to-do kept on the device back to the device", async () => {
    const device = createDevice();
    const todo = await device.repository.add("Private");

    await device.repository.setSynced(todo.id, false);
    await device.repository.remove(todo.id);

    const [trashed] = (await device.repository.load()).trash;

    expect(trashed).toMatchObject({ keepOnDevice: true });

    await device.repository.restore([trashed!]);
    expect((await device.repository.load()).todos).toMatchObject([{ location: "device", keepOnDevice: true }]);
  });

  it("moves erased done to-dos to the trash", async () => {
    const device = createDevice();
    const a = await device.repository.add("A");

    await device.repository.add("B");
    await device.repository.update(a.id, { done: true });
    await device.repository.clearCompleted();

    expect((await device.repository.load()).trash).toMatchObject([{ text: "A", done: true }]);
  });

  it("deletes trashed to-dos for good, one by one or all at once", async () => {
    const device = createDevice();
    const ids = [];

    for (const text of ["A", "B", "C"]) {
      ids.push((await device.repository.add(text)).id);
    }

    for (const id of ids) {
      await device.repository.remove(id);
    }

    await device.repository.deleteForever(ids[0]!);
    expect((await device.repository.load()).trash).toHaveLength(2);

    expect(await device.repository.emptyTrash()).toBe(2);
    expect(await device.repository.emptyTrash()).toBe(0);
    expect([...device.local.data.keys()].filter(key => key.startsWith("x:"))).toEqual([]);
  });

  it("forgets trashed to-dos after 30 days", async () => {
    const device = createDevice();
    const old = await device.repository.add("Old");

    await device.repository.remove(old.id);
    device.clock.now += 29 * 24 * 60 * 60 * 1000;

    const recent = await device.repository.add("Recent");

    await device.repository.remove(recent.id);
    device.clock.now += 2 * 24 * 60 * 60 * 1000;
    await device.repository.flush();

    expect((await device.repository.load()).trash.map(todo => todo.text)).toEqual(["Recent"]);
  });

  it("tells subscribers when the trash changes", async () => {
    const device = createDevice();
    const todo = await device.repository.add("A");

    await device.repository.remove(todo.id);

    const listener = vi.fn();

    device.repository.subscribe(listener);
    await device.repository.deleteForever(todo.id);

    expect(listener).toHaveBeenCalledWith("local");
  });
});

describe("without sync", () => {
  it("stores everything on the device when the browser has no sync storage", async () => {
    const device = createDevice({ noSync: true });

    await device.repository.add("A");
    await device.repository.flush();

    const { todos, status } = await device.repository.load();

    expect(status.mode).toBe("local");
    expect(todos).toMatchObject([{ text: "A", location: "device", pending: false }]);
  });

  it("switches to the device when sync turns out to be disabled", async () => {
    const device = createDevice();

    vi.spyOn(device.sync, "get").mockRejectedValue(new Error("Please set webextensions.storage.sync.enabled to true in about:config"));

    await device.repository.add("A");

    const { todos, status } = await device.repository.load();

    expect(status.mode).toBe("local");
    expect(todos).toMatchObject([{ text: "A", location: "device" }]);
  });

  it("moves pending to-dos to the device when a sync write says sync is unavailable", async () => {
    const device = createDevice();

    await device.repository.add("A");
    vi.spyOn(device.sync, "set").mockRejectedValueOnce(new Error("storage.sync is not supported"));
    await device.repository.flush();

    expect((await device.repository.load()).todos).toMatchObject([{ text: "A", location: "device", pending: false }]);
  });
});

describe("several devices", () => {
  it("shows to-dos added on another device and notifies subscribers", async () => {
    const laptop = createDevice();
    const phone = createDevice({ sync: laptop.sync });
    const listener = vi.fn();

    // The shared sync area notifies the laptop's listeners.
    laptop.repository.subscribe(listener);
    await phone.repository.add("From the phone");
    await phone.repository.flush();

    expect(await texts(laptop)).toEqual(["From the phone"]);
    expect(listener).toHaveBeenCalledWith("sync");
  });

  it("keeps both reorders when two devices move different to-dos", async () => {
    const laptop = createDevice();
    const phone = createDevice({ sync: laptop.sync });
    const ids = [];

    for (const text of ["A", "B", "C", "D"]) {
      ids.push((await laptop.repository.add(text)).id);
    }

    await laptop.repository.flush();

    await laptop.repository.move(ids[3]!, 0);
    await phone.repository.move(ids[0]!, 3);
    await laptop.repository.flush();
    await phone.repository.flush();

    expect(await texts(laptop)).toEqual(["D", "B", "C", "A"]);
    expect(await texts(phone)).toEqual(["D", "B", "C", "A"]);
  });

  it("orders to-dos added at the same spot on two devices the same way everywhere", async () => {
    const laptop = createDevice();
    const phone = createDevice({ sync: laptop.sync });

    await laptop.repository.add("Laptop");
    await phone.repository.add("Phone");
    await laptop.repository.flush();
    await phone.repository.flush();

    expect(await texts(laptop)).toEqual(await texts(phone));
    expect(await texts(laptop)).toHaveLength(2);
  });

  it("keeps the newer copy when a to-do is left in both areas", async () => {
    const device = createDevice();
    const record = { t: "old", d: 0, p: "a0", c: 1, u: 1 };

    await device.sync.set({ "t:dup": record });
    await device.local.set({ "t:dup": { ...record, t: "new", u: 2 } });

    expect(await texts(device)).toEqual(["new"]);

    await device.repository.flush();
    expect(device.sync.data.has("t:dup")).toBe(false);
    expect(await texts(device)).toEqual(["new"]);
  });
});

describe("subscribe", () => {
  it("ignores unrelated keys and areas, and stops after unsubscribing", async () => {
    const listeners = new Set<(changes: Record<string, unknown>, area: string) => void>();
    const local = memoryArea("local", listeners);
    const device = createDevice({
      local,
      onChanged: { addListener: l => listeners.add(l), removeListener: l => listeners.delete(l) },
    });
    const listener = vi.fn();
    const unsubscribe = device.repository.subscribe(listener);

    await local.set({ unrelated: 1 });
    expect(listener).not.toHaveBeenCalled();

    await device.repository.add("A");
    expect(listener).toHaveBeenCalledWith("local");

    unsubscribe();
    listener.mockClear();
    await device.repository.add("B");
    expect(listener).not.toHaveBeenCalled();
  });
});
