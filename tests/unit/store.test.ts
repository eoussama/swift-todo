import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TodoStore } from "~/lib/todos/todos.svelte";

import { createDevice } from "./helpers";



beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("todoStore", () => {
  it("loads, counts and follows changes", async () => {
    const device = createDevice();
    const store = new TodoStore(device.repository);
    const stop = await store.start();

    expect(store.ready).toBe(true);

    await store.add("A");
    const b = await store.add("B");

    await store.toggle(b!.id);

    expect(store.todos.map(todo => todo.text)).toEqual(["A", "B"]);
    expect(store.remaining).toBe(1);
    expect(store.completed).toBe(1);

    // A change from elsewhere (here: another device) shows up after the debounce.
    const phone = createDevice({ sync: device.sync });

    await phone.repository.add("C");
    await phone.repository.flush();
    await vi.advanceTimersByTimeAsync(50);

    expect(store.todos.map(todo => todo.text)).toContain("C");

    stop();
  });

  it("reports refusals as errors and clears them on the next success", async () => {
    const store = new TodoStore(createDevice().repository);

    await store.start();

    expect(await store.add("  ")).toBeUndefined();
    expect(store.error).toMatchObject({ code: "empty" });

    await store.add("Fine");
    expect(store.error).toBeNull();
  });

  it("reorders immediately, and undoes a removal", async () => {
    const store = new TodoStore(createDevice().repository);

    await store.start();

    for (const text of ["A", "B", "C"]) {
      await store.add(text);
    }

    const moving = store.move(store.todos[2]!.id, 0);

    expect(store.todos.map(todo => todo.text)).toEqual(["C", "A", "B"]);
    await moving;

    const removed = await store.remove(store.todos[1]!.id);

    expect(store.todos.map(todo => todo.text)).toEqual(["C", "B"]);

    await store.restore([removed!]);
    expect(store.todos.map(todo => todo.text)).toEqual(["C", "A", "B"]);

    await store.toggle(store.todos[0]!.id);
    expect((await store.clearCompleted())?.map(todo => todo.text)).toEqual(["C"]);
  });

  it("lets the user choose what syncs, and reports refusals", async () => {
    const store = new TodoStore(createDevice({ noSync: true }).repository);

    await store.start();
    await store.add("A");

    await store.setSynced(store.todos[0]!.id, true);
    expect(store.error).toMatchObject({ code: "sync-unavailable" });

    await store.setSynced(store.todos[0]!.id, false);
    expect(store.error).toBeNull();
    expect(store.status.keptOnDevice).toBe(1);
  });
});
