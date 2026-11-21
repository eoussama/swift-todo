import { describe, expect, it } from "vitest";

import { parseBackup } from "~/lib/export/backup";
import { BACKUP_APP, BACKUP_VERSION } from "~/lib/export/formats";
import { addToHistory, decodeHistory, encodeHistory, HISTORY_LIMIT } from "~/lib/todos/history";
import { decodeTodo, encodeTodo } from "~/lib/todos/model";
import { lastPosition } from "~/lib/todos/ordering";

import { createDevice } from "./helpers";



const MINUTE = 60_000;
// Saturday 2026-11-21, 10:30:45 local time.
const NOW = new Date(2026, 10, 21, 10, 30, 45);

describe("check-off history", () => {
  it("stores each check-off as base-36 minutes, a few characters each", () => {
    expect(encodeHistory([0, 35 * MINUTE + 59_999, 36 * MINUTE])).toBe("0 z 10");
    expect(encodeHistory([])).toBe("");
    expect(encodeHistory([NOW.getTime()]).length).toBeLessThanOrEqual(6);
  });

  it("reads it back, to the minute, oldest first", () => {
    expect(decodeHistory("z 10")).toEqual([35 * MINUTE, 36 * MINUTE]);
    expect(decodeHistory(encodeHistory([NOW.getTime()]))).toEqual([Math.floor(NOW.getTime() / MINUTE) * MINUTE]);
  });

  it("drops anything malformed, and keeps only the latest", () => {
    expect(decodeHistory(undefined)).toEqual([]);
    expect(decodeHistory(42)).toEqual([]);
    expect(decodeHistory("")).toEqual([]);
    expect(decodeHistory("z  -1 Z 0 abcdefghij 1.5 10")).toEqual([35 * MINUTE, 36 * MINUTE]);
    expect(decodeHistory("abcdefghi")).toEqual([Number.parseInt("abcdefghi", 36) * MINUTE]);

    const many = Array.from({ length: HISTORY_LIMIT + 5 }, (_, i) => (i + 1).toString(36)).join(" ");

    expect(HISTORY_LIMIT).toBe(30);
    expect(decodeHistory(many)).toHaveLength(HISTORY_LIMIT);
    expect(decodeHistory(many)[0]).toBe(6 * MINUTE);
    expect(encodeHistory(Array.from({ length: HISTORY_LIMIT + 5 }, (_, i) => (i + 1) * MINUTE)).split(" ")).toHaveLength(HISTORY_LIMIT);
    expect(encodeHistory(Array.from({ length: HISTORY_LIMIT + 5 }, (_, i) => (i + 1) * MINUTE)).split(" ")[0]).toBe("6");
  });

  it("adds a check-off to the minute, dropping the oldest past the limit", () => {
    const minute = Math.floor(NOW.getTime() / MINUTE) * MINUTE;
    const full = Array.from({ length: HISTORY_LIMIT }, (_, i) => (i + 1) * MINUTE);
    const before = [MINUTE];

    expect(addToHistory(before, NOW)).toEqual([MINUTE, minute]);
    expect(before).toEqual([MINUTE]);
    expect(addToHistory(full, NOW)).toHaveLength(HISTORY_LIMIT);
    expect(addToHistory(full, NOW)[0]).toBe(2 * MINUTE);
    expect(addToHistory(full, NOW).at(-1)).toBe(minute);
  });

  it("is stored with the to-do as `h`, only when there is one", () => {
    const base = { text: "Water plants", done: false, position: "a0", createdAt: 1, updatedAt: 2 };

    expect(encodeTodo({ ...base, history: [] })).not.toHaveProperty("h");
    expect(encodeTodo(base)).not.toHaveProperty("h");

    const record = encodeTodo({ ...base, history: [35 * MINUTE] });

    expect(record.h).toBe("z");
    expect(decodeTodo("x", record, "sync")).toMatchObject({ history: [35 * MINUTE], extra: {} });
  });

  it("goes into backups and comes back, dropping bad entries", () => {
    const backup = {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      todos: [
        { id: "a1", text: "Water plants", position: "a0", repeat: "3d", history: [35 * MINUTE, "x", -5, null, Number.NaN, 36 * MINUTE] },
        { id: "a2", text: "Odd", position: "a1", history: "z" },
      ],
    };
    const { data } = parseBackup(JSON.stringify(backup));

    expect(data.todos[0]?.history).toEqual([35 * MINUTE, 36 * MINUTE]);
    expect(data.todos[1]?.history).toEqual([]);
  });

  it("is saved by the repository with a new position, and an identical update writes nothing", async () => {
    const device = createDevice();
    const todo = await device.repository.add("Water plants", { repeat: "3d" });

    await device.repository.add("Later");
    await device.repository.flush();
    await device.repository.update(todo.id, { history: [35 * MINUTE], position: "a9" });

    let [, moved] = (await device.repository.load()).todos;

    expect(moved).toMatchObject({ id: todo.id, history: [35 * MINUTE], position: "a9", pending: true });

    await device.repository.flush();
    await device.repository.update(todo.id, { history: [35 * MINUTE], position: "a9" });
    [, moved] = (await device.repository.load()).todos;
    expect(moved?.pending).toBe(false);

    // A different history alone is a change.
    await device.repository.update(todo.id, { history: [36 * MINUTE] });
    [, moved] = (await device.repository.load()).todos;
    expect(moved).toMatchObject({ history: [36 * MINUTE], pending: true });

    await device.repository.flush();
    await device.repository.update(todo.id, { position: "a8" });
    [, moved] = (await device.repository.load()).todos;
    expect(moved).toMatchObject({ position: "a8", pending: true });
  });
});

describe("lastPosition", () => {
  it("finds the highest position, in any order", () => {
    expect(lastPosition([])).toBeNull();
    expect(lastPosition([{ position: "a1" }])).toBe("a1");
    expect(lastPosition([{ position: "a3" }, { position: "a1" }, { position: "a2" }])).toBe("a3");
    expect(lastPosition([{ position: "a1" }, { position: "a3" }, { position: "a2" }])).toBe("a3");
  });
});
