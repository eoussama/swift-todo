import { describe, expect, it } from "vitest";

import { parseBackup } from "~/lib/export/backup";
import { BACKUP_APP, BACKUP_VERSION, toBackup } from "~/lib/export/formats";
import { DEFAULT_PREFS } from "~/lib/prefs/prefs";
import { decodeTodo, encodeTodo } from "~/lib/todos/model";
import { moveAnchor, pinnedFirst } from "~/lib/todos/view";

import { createDevice } from "./helpers";



const item = (id: string, pinned = false) => ({ id, pinned });

describe("pinned to-dos", () => {
  it("are stored with `n: 1`, only when pinned", () => {
    const base = { text: "Call mom", done: false, position: "a0", createdAt: 1, updatedAt: 2 };

    expect(encodeTodo({ ...base, pinned: true }).n).toBe(1);
    expect(encodeTodo({ ...base, pinned: false })).not.toHaveProperty("n");
    expect(encodeTodo(base)).not.toHaveProperty("n");
    expect(decodeTodo("x", { ...encodeTodo(base), n: 1 }, "sync")).toMatchObject({ pinned: true, extra: {} });
    expect(decodeTodo("x", { ...encodeTodo(base), n: 2 } as never, "sync").pinned).toBe(false);
  });

  it("stay pinned through a backup", () => {
    const todo = decodeTodo("a1", encodeTodo({ text: "Call mom", done: false, position: "a0", createdAt: 1, updatedAt: 2, pinned: true }), "sync");
    const backup = toBackup({ todos: [todo], lists: [], prefs: DEFAULT_PREFS }, new Date());

    expect(backup.todos[0]?.pinned).toBe(true);
    expect(parseBackup(JSON.stringify(backup)).data.todos[0]?.pinned).toBe(true);
    expect(parseBackup(JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION, todos: [{ id: "a2", text: "x", position: "a0", pinned: 1 }] })).data.todos[0]?.pinned).toBe(false);
  });

  it("are pinned and unpinned through updates, and the same setting again writes nothing", async () => {
    const device = createDevice();
    const todo = await device.repository.add("Call mom");
    const first = async () => (await device.repository.load()).todos[0];

    await device.repository.flush();
    await device.repository.update(todo.id, { pinned: true });
    expect(await first()).toMatchObject({ pinned: true, pending: true });

    await device.repository.flush();
    await device.repository.update(todo.id, { pinned: true });
    expect((await first())?.pending).toBe(false);

    await device.repository.update(todo.id, { pinned: false });
    expect((await first())?.pinned).toBe(false);
  });

  it("lead the list, each group keeping its order", () => {
    const list = [item("a"), item("b", true), item("c"), item("d", true)];

    expect(pinnedFirst(list).map(todo => todo.id)).toEqual(["b", "d", "a", "c"]);
    expect(pinnedFirst([])).toEqual([]);
    expect(list.map(todo => todo.id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("moveAnchor", () => {
  it("places a moved to-do against a neighbor in its own group", () => {
    // Dropped first among the unpinned: after a pinned one would mean nothing, so before the next.
    expect(moveAnchor([item("p", true), item("x"), item("a")], 1)).toEqual({ before: "a" });
    // Among its own: after the one above.
    expect(moveAnchor([item("p", true), item("a"), item("x")], 2)).toEqual({ after: "a" });
    // Last of the pinned, with unpinned below: after the pinned one above.
    expect(moveAnchor([item("p", true), item("x", true), item("a")], 1)).toEqual({ after: "p" });
    // First of the pinned: before the next pinned one.
    expect(moveAnchor([item("x", true), item("p", true), item("a")], 0)).toEqual({ before: "p" });
  });

  it("falls back to any neighbor when it's alone in its group, and to nothing when alone in the list", () => {
    expect(moveAnchor([item("p", true), item("x")], 1)).toEqual({ after: "p" });
    expect(moveAnchor([item("x", true), item("a")], 0)).toEqual({ before: "a" });
    expect(moveAnchor([item("x")], 0)).toBeNull();
    expect(moveAnchor([], 0)).toBeNull();
  });
});
