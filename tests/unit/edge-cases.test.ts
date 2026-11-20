import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withLock } from "~/lib/todos/lock";
import { TodoStore } from "~/lib/todos/todos.svelte";

import { createDevice } from "./helpers";



beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("withLock without the Web Locks API", () => {
  it("runs tasks one after another, even when one fails", async () => {
    vi.stubGlobal("navigator", {});

    const order: Array<string> = [];
    const slow = withLock("x", async () => {
      await Promise.resolve();
      order.push("slow");
    });
    const failing = withLock("x", () => {
      order.push("failing");
      throw new Error("nope");
    });
    const last = withLock("x", () => order.push("last"));

    await slow;
    await expect(failing).rejects.toThrow("nope");
    await last;

    expect(order).toEqual(["slow", "failing", "last"]);
  });
});

describe("repository edge cases", () => {
  it("returns a no-op unsubscribe when change events aren't available", () => {
    const device = createDevice({ onChanged: undefined });

    expect(() => device.repository.subscribe(() => {})()).not.toThrow();
  });

  it("surfaces unexpected read errors", async () => {
    const device = createDevice();

    vi.spyOn(device.sync, "get").mockRejectedValue(new Error("disk on fire"));
    await expect(device.repository.load()).rejects.toThrow("disk on fire");
  });

  it("keeps a delete pending when only the removal write fails", async () => {
    const device = createDevice();
    const todo = await device.repository.add("A");

    await device.repository.flush();
    await device.repository.remove(todo.id);
    vi.spyOn(device.sync, "remove").mockRejectedValueOnce(new Error("MAX_WRITE_OPERATIONS_PER_HOUR quota exceeded"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await device.repository.flush();

    expect((await device.repository.load()).status.pending).toBe(1);

    await device.repository.flush();
    expect(device.sync.data.has(`t:${todo.id}`)).toBe(false);
  });

  it("retries after an unknown write error, and gives up demoting after repeated quota errors", async () => {
    const device = createDevice();

    await device.repository.add("A");

    const set = vi.spyOn(device.sync, "set")
      .mockRejectedValueOnce(new Error("QUOTA_BYTES quota exceeded"))
      .mockRejectedValueOnce(new Error("QUOTA_BYTES quota exceeded"))
      .mockRejectedValueOnce(new Error("QUOTA_BYTES quota exceeded"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // 1st try, then new items local, then everything local: the meta key still needs a write.
    await device.repository.flush();

    expect(set).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalled();
    expect((await device.repository.load()).status.retryAt).not.toBeNull();
  });

  it("flushes from the timer after a change", async () => {
    const device = createDevice();
    const set = vi.spyOn(device.sync, "set");

    await device.repository.add("A");
    await vi.advanceTimersByTimeAsync(1_000);

    expect(set).toHaveBeenCalled();
  });

  it("logs a flush that fails in the background", async () => {
    const device = createDevice();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await device.repository.add("A");
    vi.spyOn(device.sync, "get").mockRejectedValue(new Error("boom"));
    await vi.advanceTimersByTimeAsync(1_000);

    expect(error).toHaveBeenCalled();
  });
});

describe("store edge cases", () => {
  it("keeps the last list and reports the error when loading fails", async () => {
    const device = createDevice();
    const store = new TodoStore(device.repository);

    await store.start();
    await store.add("A");

    vi.spyOn(device.sync, "get").mockRejectedValue(new Error("boom"));
    await store.refresh();

    expect(store.error?.message).toBe("boom");
    expect(store.todos).toHaveLength(1);

    store.dismissError();
    expect(store.error).toBeNull();
  });

  it("ignores moves and toggles of unknown or unmoved to-dos", async () => {
    const device = createDevice();
    const store = new TodoStore(device.repository);
    const move = vi.spyOn(device.repository, "move");

    await store.start();
    await store.add("A");
    await store.move("missing", 0);
    await store.move(store.todos[0]!.id, 0);
    await store.toggle("missing");

    expect(move).not.toHaveBeenCalled();
    expect(store.todos[0]!.done).toBe(false);
  });

  it("flushes when another device changes sync while to-dos wait on this device", async () => {
    const device = createDevice();
    const store = new TodoStore(device.repository);

    await device.local.set({ "t:local": { t: "Local", d: 0, p: "a0", c: 1, u: 1 } });
    await device.repository.flush();
    await device.sync.set({ "t:remote": { t: "Remote", d: 0, p: "a1", c: 1, u: 1 } });

    await store.start();
    store.status = { ...store.status, deviceOnly: 1 };

    const flush = vi.spyOn(device.repository, "flush");

    await device.sync.set({ "t:other": { t: "Other", d: 0, p: "a2", c: 1, u: 1 } });

    expect(flush).toHaveBeenCalled();
  });
});
