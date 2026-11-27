import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseBackup } from "~/lib/export/backup";
import { toBackup } from "~/lib/export/formats";
import { DEFAULT_PREFS, parsePrefs } from "~/lib/prefs/prefs";
import { decodeTodo, encodeTodo } from "~/lib/todos/model";
import { isStageValue, MAX_STAGE_NAME_LENGTH, MAX_STAGES_PER_STATUS, normalizeStageName, parseStages, stageOf, stagesUnder, statusFields, statusOf } from "~/lib/todos/status";
import { TodoStore } from "~/lib/todos/todos.svelte";

import { createDevice } from "./helpers";



const review = { id: "rev001", name: "Review", status: "doing" as const };
const shipped = { id: "shp001", name: "Shipped", status: "done" as const };
const next = { id: "nxt001", name: "Next up", status: "todo" as const };
const stages = [review, shipped, next];

describe("statusOf", () => {
  it("reads to do, in progress and done from being done and the stage", () => {
    expect(statusOf({ done: false, stage: null })).toBe("todo");
    expect(statusOf({ done: false, stage: "doing" })).toBe("doing");
    expect(statusOf({ done: false, stage: "doing:rev001" })).toBe("doing");
    expect(statusOf({ done: false, stage: "todo:nxt001" })).toBe("todo");
    expect(statusOf({ done: true, stage: null })).toBe("done");
    expect(statusOf({ done: true, stage: "done:shp001" })).toBe("done");
  });

  it("lets being done win, as a version without stages sets it", () => {
    // Checked off there, while in progress.
    expect(statusOf({ done: true, stage: "doing" })).toBe("done");
    // Unchecked there, while at a stage under Done.
    expect(statusOf({ done: false, stage: "done:shp001" })).toBe("todo");
    expect(statusOf({ done: false, stage: "done" })).toBe("todo");
    expect(statusOf({ done: false, stage: "nonsense" })).toBe("todo");
  });
});

describe("stageOf", () => {
  it("finds the stage of one's own a to-do is at, while it fits its status", () => {
    expect(stageOf({ done: false, stage: "doing:rev001" }, stages)).toBe(review);
    expect(stageOf({ done: true, stage: "done:shp001" }, stages)).toBe(shipped);
    expect(stageOf({ done: false, stage: "todo:nxt001" }, stages)).toBe(next);
  });

  it("finds none for no stage, one that's gone, one that no longer fits, or one listed under another status", () => {
    expect(stageOf({ done: false, stage: null }, stages)).toBeNull();
    expect(stageOf({ done: false, stage: "doing" }, stages)).toBeNull();
    expect(stageOf({ done: false, stage: "doing:gone01" }, stages)).toBeNull();
    expect(stageOf({ done: true, stage: "doing:rev001" }, stages)).toBeNull();
    expect(stageOf({ done: false, stage: "todo:rev001" }, stages)).toBeNull();
  });
});

describe("statusFields", () => {
  it("stores no stage for plainly to do or done, and the status with a stage of one's own", () => {
    expect(statusFields("todo")).toEqual({ done: false, stage: null });
    expect(statusFields("done")).toEqual({ done: true, stage: null });
    expect(statusFields("doing")).toEqual({ done: false, stage: "doing" });
    expect(statusFields("doing", review)).toEqual({ done: false, stage: "doing:rev001" });
    expect(statusFields("done", shipped)).toEqual({ done: true, stage: "done:shp001" });
    expect(statusFields("todo", next)).toEqual({ done: false, stage: "todo:nxt001" });
  });

  it("writes only values it reads back", () => {
    for (const status of ["todo", "doing", "done"] as const) {
      const { stage } = statusFields(status, { id: "abc123" });

      expect(isStageValue(stage)).toBe(true);
    }

    expect(isStageValue("doing:")).toBe(false);
    expect(isStageValue("later")).toBe(false);
    expect(isStageValue(3)).toBe(false);
  });
});

describe("stages of one's own", () => {
  it("cleans up names", () => {
    expect(normalizeStageName("  In   review ")).toBe("In review");
    expect(normalizeStageName("x".repeat(40))).toHaveLength(MAX_STAGE_NAME_LENGTH);
    expect(normalizeStageName(" \n ")).toBe("");
  });

  it("reads stored stages, skipping malformed, duplicate and blank ones, and those past the limit", () => {
    const many = Array.from({ length: MAX_STAGES_PER_STATUS + 2 }, (_, index) => ({ id: `d${index}`, name: `D${index}`, status: "done" }));

    expect(parseStages([
      { id: "rev001", name: " Review ", status: "doing" },
      { id: "rev001", name: "Again", status: "doing" },
      { id: "BAD!", name: "Bad", status: "doing" },
      { id: "x1", name: "Nowhere", status: "later" },
      { id: "x2", name: "  ", status: "todo" },
      { id: "x3", name: 4, status: "todo" },
      "nope",
      ...many,
    ])).toEqual([{ id: "rev001", name: "Review", status: "doing" }, ...many.slice(0, MAX_STAGES_PER_STATUS)]);
    expect(parseStages(null)).toEqual([]);
  });

  it("lists those under a status", () => {
    expect(stagesUnder(stages, "doing")).toEqual([review]);
    expect(stagesUnder(stages, "todo")).toEqual([next]);
  });

  it("are kept in the settings", () => {
    expect(DEFAULT_PREFS.stages).toEqual([]);
    expect(parsePrefs({ stages: [review, { id: "", name: "x", status: "todo" }] }).stages).toEqual([review]);
  });
});

describe("stored stage", () => {
  const todo = { text: "Ship it", done: false, position: "a0", createdAt: 1, updatedAt: 2 };

  it("is written only when set, and read back only when well-formed", () => {
    expect(encodeTodo(todo)).not.toHaveProperty("g");
    expect(encodeTodo({ ...todo, stage: "doing:rev001" }).g).toBe("doing:rev001");
    expect(decodeTodo("a", { ...encodeTodo(todo), g: "doing:rev001" }, "sync").stage).toBe("doing:rev001");
    expect(decodeTodo("a", { ...encodeTodo(todo), g: "soon" }, "sync").stage).toBeNull();
  });

  it("goes into backups and comes back from them", () => {
    const stored = decodeTodo("abc", encodeTodo({ ...todo, stage: "doing" }), "sync");
    const backup = toBackup({ todos: [stored], lists: [], prefs: { ...DEFAULT_PREFS, stages: [review] } }, new Date(0));
    const { data } = parseBackup(JSON.stringify(backup));

    expect(data.todos[0]!.stage).toBe("doing");
    expect(data.prefs!.stages).toEqual([review]);
  });
});

describe("todoStore statuses", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function started() {
    const device = createDevice();
    const store = new TodoStore(device.repository, { now: () => new Date(2026, 10, 27, 9) });

    await store.start();

    return { device, store };
  }

  it("moves a to-do between statuses and stages, and checking it off or back clears the stage", async () => {
    const { store } = await started();
    const task = await store.add("Write the docs");
    const stage = await store.addStage("doing", "Review");
    const current = () => store.todos.find(item => item.id === task!.id)!;

    expect(await store.setStatus(task!.id, "doing")).toBeNull();
    expect(statusOf(current())).toBe("doing");

    await store.setStatus(task!.id, "doing", stage!);
    expect(stageOf(current(), store.prefs.stages)).toEqual(stage);

    // Checked off from in progress: plainly done; back again, plainly to do.
    await store.toggle(task!.id);
    expect(current()).toMatchObject({ done: true, stage: null });
    await store.toggle(task!.id);
    expect(current()).toMatchObject({ done: false, stage: null });

    const shipped = await store.addStage("done", "Shipped");

    await store.setStatus(task!.id, "done", shipped!);
    expect(current()).toMatchObject({ done: true, stage: `done:${shipped!.id}` });
    // Already done, it only changes its stage.
    await store.setStatus(task!.id, "done");
    expect(current()).toMatchObject({ done: true, stage: null });

    expect(await store.setStatus("missing", "doing")).toBeUndefined();

    // Without a clock of its own, it goes by the real one.
    const plain = new TodoStore(createDevice().repository);

    await plain.start();

    const other = await plain.add("Other");

    expect(await plain.setStatus(other!.id, "done")).toBeNull();
    expect(plain.todos[0]!.done).toBe(true);
  });

  it("moves a repeating to-do to its next date when set to done, starting over as to do", async () => {
    const { store } = await started();
    const task = await store.add("Water the plants", { due: "2026-11-27", repeat: "1d" });

    await store.setStatus(task!.id, "doing");
    expect(await store.setStatus(task!.id, "done")).toBe("2026-11-28");
    expect(store.todos[0]).toMatchObject({ done: false, stage: null, due: "2026-11-28" });
  });

  it("adds, renames, moves and deletes stages, within limits", async () => {
    const { store } = await started();
    const a = await store.addStage("doing", "  Review ");
    const b = await store.addStage("todo", "Next up");
    const c = await store.addStage("doing", "Blocked");

    expect(store.prefs.stages.map(stage => stage.name)).toEqual(["Review", "Next up", "Blocked"]);

    expect(await store.addStage("doing", "  ")).toBeUndefined();
    expect(store.error).toMatchObject({ code: "empty" });

    await store.renameStage(a!.id, "In review");
    await store.renameStage(a!.id, " ");
    expect(store.prefs.stages[0]!.name).toBe("In review");

    // Past the To do one between them, among its own status.
    await store.moveStage(c!.id, -1);
    expect(store.prefs.stages.map(stage => stage.name)).toEqual(["Blocked", "Next up", "In review"]);
    await store.moveStage(c!.id, -1);
    await store.moveStage(b!.id, 1);
    await store.moveStage("missing", 1);
    expect(store.prefs.stages.map(stage => stage.name)).toEqual(["Blocked", "Next up", "In review"]);

    await store.deleteStage(b!.id);
    expect(store.prefs.stages.map(stage => stage.name)).toEqual(["Blocked", "In review"]);

    for (let index = 0; index < 4; index++) {
      await store.addStage("doing", `Extra ${index}`);
    }

    expect(await store.addStage("doing", "One too many")).toBeUndefined();
    expect(store.error).toMatchObject({ code: "too-many-stages" });
  });
});
