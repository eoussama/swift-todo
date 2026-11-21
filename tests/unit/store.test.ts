import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_LISTS } from "~/lib/todos/lists";
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

  it("lists, restores and deletes trashed to-dos", async () => {
    const store = new TodoStore(createDevice().repository);

    await store.start();

    for (const text of ["A", "B", "C"]) {
      await store.add(text);
    }

    await store.remove(store.todos[0]!.id);
    await store.remove(store.todos[0]!.id);
    expect(store.trash.map(todo => todo.text).sort()).toEqual(["A", "B"]);

    await store.restoreFromTrash(store.trash.find(todo => todo.text === "A")!.id);
    expect(store.todos.map(todo => todo.text)).toEqual(["A", "C"]);

    await store.restoreFromTrash("missing");
    await store.deleteForever(store.trash[0]!.id);
    expect(store.trash).toEqual([]);

    await store.remove(store.todos[0]!.id);
    expect(await store.emptyTrash()).toBe(1);
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

  it("creates, renames, reorders and deletes lists", async () => {
    const store = new TodoStore(createDevice().repository);

    await store.start();

    const work = await store.addList("  Work ", "💼");
    const home = await store.addList("Home");

    expect(store.lists).toEqual([work, home]);
    expect(work).toMatchObject({ name: "Work", emoji: "💼" });

    expect(await store.addList("   ")).toBeUndefined();
    expect(store.error).toMatchObject({ code: "empty" });

    await store.renameList(work!.id, "Office", null);
    expect(store.lists[0]).toMatchObject({ name: "Office", emoji: null });

    await store.renameList(work!.id, " ", null);
    expect(store.error).toMatchObject({ code: "empty" });

    await store.moveList(home!.id, -1);
    expect(store.lists.map(list => list.name)).toEqual(["Home", "Office"]);

    // Out of bounds and unknown lists are ignored.
    await store.moveList(home!.id, -1);
    await store.moveList("missing", 1);
    expect(store.lists.map(list => list.name)).toEqual(["Home", "Office"]);

    await store.add("Task", { list: home!.id });
    await store.deleteList(home!.id);
    expect(store.lists.map(list => list.name)).toEqual(["Office"]);
    expect(store.todos[0]!.list).toBeNull();
  });

  it("refuses more lists than the limit", async () => {
    const store = new TodoStore(createDevice().repository);

    await store.start();

    for (let i = 0; i < MAX_LISTS; i++) {
      await store.addList(`List ${i}`);
    }

    expect(await store.addList("One too many")).toBeUndefined();
    expect(store.error).toMatchObject({ code: "too-many-lists" });
  });

  it("applies settings right away and saves them", async () => {
    const device = createDevice();
    const store = new TodoStore(device.repository);

    await store.start();

    const saving = store.savePrefs({ skin: "minimal" });

    expect(store.prefs.skin).toBe("minimal");
    await saving;
    expect((await device.repository.load()).prefs.skin).toBe("minimal");
  });

  it("imports a backup", async () => {
    const store = new TodoStore(createDevice().repository);

    await store.start();

    const result = await store.importData({ todos: [], lists: [{ id: "a", name: "A", emoji: null }], prefs: null }, "merge");

    expect(result).toEqual({ added: 0, skipped: 0, trashed: 0 });
    expect(store.lists).toHaveLength(1);
  });

  it("clears only the given done to-dos", async () => {
    const store = new TodoStore(createDevice().repository);

    await store.start();

    for (const text of ["A", "B"]) {
      await store.add(text);
    }

    for (const todo of [...store.todos]) {
      await store.toggle(todo.id);
    }

    const cleared = await store.clearCompleted([store.todos[0]!.id]);

    expect(cleared?.map(todo => todo.text)).toEqual(["A"]);
    expect(store.todos.map(todo => todo.text)).toEqual(["B"]);
  });
});
