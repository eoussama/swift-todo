import { describe, expect, it } from "vitest";

import { parseBackup } from "~/lib/export/backup";
import { BACKUP_APP, BACKUP_VERSION, toBackup } from "~/lib/export/formats";
import { DEFAULT_PREFS } from "~/lib/prefs/prefs";
import { decodeTodo, encodeTodo, shownText } from "~/lib/todos/model";

import { createDevice } from "./helpers";



describe("hidden to-dos", () => {
  it("stand in for their text wherever it would show", () => {
    expect(shownText({ text: "Wi-Fi: hunter2", hidden: true }, "Hidden to-do")).toBe("Hidden to-do");
    expect(shownText({ text: "Buy milk", hidden: false }, "Hidden to-do")).toBe("Buy milk");
  });

  it("are stored with `v: 1`, only when hidden", () => {
    const base = { text: "Wi-Fi: hunter2", done: false, position: "a0", createdAt: 1, updatedAt: 2 };

    expect(encodeTodo({ ...base, hidden: true }).v).toBe(1);
    expect(encodeTodo({ ...base, hidden: false })).not.toHaveProperty("v");
    expect(encodeTodo(base)).not.toHaveProperty("v");
    expect(decodeTodo("x", { ...encodeTodo(base), v: 1 }, "sync")).toMatchObject({ hidden: true, extra: {} });
    expect(decodeTodo("x", { ...encodeTodo(base), v: 2 } as never, "sync").hidden).toBe(false);
  });

  it("stay hidden through a backup", () => {
    const todo = decodeTodo("a1", encodeTodo({ text: "PIN 1234", done: false, position: "a0", createdAt: 1, updatedAt: 2, hidden: true }), "sync");
    const backup = toBackup({ todos: [todo], lists: [], prefs: DEFAULT_PREFS }, new Date());

    expect(backup.todos[0]?.hidden).toBe(true);
    expect(parseBackup(JSON.stringify(backup)).data.todos[0]?.hidden).toBe(true);
    expect(parseBackup(JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION, todos: [{ id: "a2", text: "x", position: "a0", hidden: "yes" }] })).data.todos[0]?.hidden).toBe(false);
  });

  it("are hidden and shown through updates, and the same setting again writes nothing", async () => {
    const device = createDevice();
    const todo = await device.repository.add("PIN 1234");
    const first = async () => (await device.repository.load()).todos[0];

    await device.repository.flush();
    await device.repository.update(todo.id, { hidden: true });
    expect(await first()).toMatchObject({ hidden: true, pending: true });

    await device.repository.flush();
    await device.repository.update(todo.id, { hidden: true });
    expect((await first())?.pending).toBe(false);

    await device.repository.update(todo.id, { hidden: false });
    expect((await first())?.hidden).toBe(false);
  });
});
