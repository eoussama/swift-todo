import type { TDevice } from "./helpers";
import type { TSyncLimits } from "~/lib/todos/limits";
import type { TList } from "~/lib/todos/lists";
import type { TTodoRecord } from "~/lib/todos/model";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFS } from "~/lib/prefs/prefs";
import { DEFAULT_SYNC_LIMITS, FLUSH_ALARM, FLUSH_ALARM_DELAY_MINUTES, FLUSH_DEBOUNCE_MS, SAFETY, TRASH_RETENTION_MS } from "~/lib/todos/limits";
import { encodeLists, MAX_LISTS } from "~/lib/todos/lists";
import { decodeTodo, encodeTodo, todoKey, trashKey } from "~/lib/todos/model";
import { areaBytes, itemBytes } from "~/lib/todos/size";

import { createDevice } from "./helpers";



/** The time on every simulated device's clock (see `createDevice`). */
const NOW = 1_000_000;

/** Limits so loose that everything fits. */
const LOOSE: Partial<TSyncLimits> = { quotaBytes: 10_000_000, maxItems: 10_000 };

const DELETE = { op: "delete" } as const;

beforeEach(() => {
  // Keep the repository's own flush timers from firing; tests advance them explicitly.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
});

function rec(text: string, position: string, fields: Partial<TTodoRecord> = {}): TTodoRecord {
  return { t: text, d: 0, p: position, c: 1, u: 1, ...fields };
}

function put(record: TTodoRecord): { op: "put"; record: TTodoRecord } {
  return { op: "put", record };
}

function doc(value: unknown): { op: "doc"; value: unknown } {
  return { op: "doc", value };
}

function withLimits(limits: Partial<TSyncLimits>, noSync = false): TDevice {
  return createDevice({ limits: { ...DEFAULT_SYNC_LIMITS, ...limits }, noSync });
}

function keys(area: TDevice["local"]): Array<string> {
  return [...area.data.keys()].sort();
}

function lists(count: number, prefix = "l"): Array<TList> {
  return Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i}`, name: `List ${i}`, emoji: null }));
}

// Waits for every storage task queued so far, a background flush included: emptying an empty trash takes the storage lock.
async function idle(device: TDevice): Promise<void> {
  await device.repository.emptyTrash();
}

// Lets pending promise callbacks run.
async function tick(): Promise<void> {
  await new Promise(resolve => setImmediate(resolve));
}

describe("reading the outbox", () => {
  it("ignores malformed entries instead of failing or counting them", async () => {
    const device = createDevice();

    device.local.data.set("outbox", {
      "nothing": null,
      "@lists": { op: "put", value: [] },
      "@unknown": doc(1),
      "@prefs": { op: "doc" },
      "broken": { op: "put", record: { t: 1 } },
      "odd": { op: "move", record: rec("Odd", "a1") },
    });

    const snapshot = await device.repository.load();

    expect(snapshot.todos).toEqual([]);
    expect(snapshot.status.pending).toBe(0);
  });

  it("queues changes under the outbox key and reports outbox changes to subscribers", async () => {
    const device = createDevice();
    const listener = vi.fn();

    device.repository.subscribe(listener);
    await device.repository.add("Queued");

    expect(Object.keys(device.local.data.get("outbox") as object)).toHaveLength(1);
    listener.mockClear();

    for (const notify of device.listeners) {
      notify({ outbox: {} }, "local");
    }

    expect(listener).toHaveBeenCalledWith("local");
  });

  it("ignores changes to areas other than sync and local", async () => {
    const device = createDevice();
    const listener = vi.fn();

    device.repository.subscribe(listener);

    for (const notify of device.listeners) {
      notify({ "t:abc": {} }, "session");
      notify({ "t:abc": {} }, "managed");
    }

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("adding", () => {
  it("plans against the documented sync limits when none are given", async () => {
    const device = createDevice({ limits: undefined });

    expect((await device.repository.load()).status.usage).toMatchObject({
      quotaBytes: DEFAULT_SYNC_LIMITS.quotaBytes,
      maxItems: DEFAULT_SYNC_LIMITS.maxItems,
    });
  });

  it("returns a pending sync to-do when sync has room", async () => {
    const device = createDevice();

    expect(await device.repository.add("Synced")).toMatchObject({ location: "sync", pending: true });
  });

  it("returns a device to-do that isn't pending when sync is off", async () => {
    const device = createDevice({ noSync: true });

    expect(await device.repository.add("Local")).toMatchObject({ location: "device", pending: false });
  });

  it("keeps to-dos on the device when they would use more keys than sync allows", async () => {
    // Five keys, four of them reserved: room for a single to-do.
    const device = withLimits({ maxItems: SAFETY.reservedItems + 1 });

    const added = await device.repository.addMany([{ text: "One" }, { text: "Two" }]);

    expect(added.map(todo => [todo.location, todo.pending])).toEqual([["device", false], ["device", false]]);
    expect(await device.repository.add("Alone")).toMatchObject({ location: "sync", pending: true });
  });

  it("keeps a to-do on the device when it alone is bigger than a sync item may be", async () => {
    const device = withLimits({ quotaBytesPerItem: 10 });

    expect(await device.repository.add("Too big")).toMatchObject({ location: "device", pending: false });
  });

  it("doesn't delete anything from the device when adding", async () => {
    const device = createDevice();
    const remove = vi.spyOn(device.local, "remove");

    await device.repository.add("New");

    expect(remove).not.toHaveBeenCalled();
  });

  it("sets the backup alarm with the shortest delay", async () => {
    const device = createDevice();

    await device.repository.add("New");

    expect(device.alarms.create).toHaveBeenCalledWith(FLUSH_ALARM, { delayInMinutes: FLUSH_ALARM_DELAY_MINUTES });
  });

  it("waits while another extension context holds the storage lock", async () => {
    const device = createDevice();
    let release!: () => void;
    let held!: () => void;
    const holding = new Promise<void>((resolve) => {
      held = resolve;
    });
    const lock = navigator.locks.request("swift-todo:storage", async () => {
      held();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });

    await holding;

    let added = false;
    const adding = device.repository.add("Later").then(() => {
      added = true;
    });

    await tick();
    expect(added).toBe(false);

    release();
    await Promise.all([adding, lock]);
    expect(added).toBe(true);
  });
});

describe("placing restored to-dos", () => {
  function restorable(text: string) {
    return decodeTodo("rs", rec(text, "a1"), "sync");
  }

  // Size of the restored record in sync; restoring stamps it with the current time.
  function restoredBytes(text: string): number {
    return itemBytes(todoKey("rs"), encodeTodo({ ...restorable(text), updatedAt: NOW }));
  }

  async function restoredLocation(limits: Partial<TSyncLimits>, text: string): Promise<string | undefined> {
    const device = withLimits(limits);

    await device.repository.restore([restorable(text)]);

    return (await device.repository.load()).todos[0]?.location;
  }

  it("syncs a to-do exactly as big as a sync item may be, and no bigger", async () => {
    const size = restoredBytes("Restored");

    expect(await restoredLocation({ quotaBytesPerItem: size }, "Restored")).toBe("sync");
    expect(await restoredLocation({ quotaBytesPerItem: size - 1 }, "Restored")).toBe("device");
  });

  it("syncs a to-do that fills sync exactly up to the safety margin, and no more", async () => {
    let text = "";
    let quota = 0;

    for (let length = 1; quota === 0; length++) {
      const candidate = "r".repeat(length);
      const size = restoredBytes(candidate);
      const exact = Math.round(size / SAFETY.quotaRatio);

      if (exact * SAFETY.quotaRatio === size) {
        text = candidate;
        quota = exact;
      }
    }

    expect(await restoredLocation({ quotaBytes: quota }, text)).toBe("sync");
    expect(await restoredLocation({ quotaBytes: quota - 1 }, text)).toBe("device");
  });

  it("doesn't touch storage when there is nothing to restore", async () => {
    const device = createDevice();

    vi.spyOn(device.sync, "get").mockRejectedValue(new Error("boom"));

    await expect(device.repository.restore([])).resolves.toBeUndefined();
  });

  it("puts a restored to-do back in the sync queue only, not on the device", async () => {
    const device = createDevice();
    const todo = await device.repository.add("Back");

    await device.repository.flush();

    const removed = await device.repository.remove(todo.id);

    await device.repository.flush();
    await device.repository.restore([removed!]);

    expect(device.local.data.has(todoKey(todo.id))).toBe(false);
    expect((await device.repository.load()).todos).toMatchObject([{ text: "Back", location: "sync", pending: true }]);
  });
});

describe("updating", () => {
  async function synced() {
    const device = createDevice();
    const todo = await device.repository.add("Task");

    await device.repository.flush();

    return { device, id: todo.id };
  }

  it.each([
    ["list", { list: "work" }],
    ["due date", { due: "2026-11-25" }],
    ["repeat rule", { repeat: "weekly" }],
    ["Today pin", { today: "2026-11-21" }],
  ])("saves a change to the %s alone", async (_, patch) => {
    const { device } = await synced();
    const [todo] = (await device.repository.load()).todos;

    await device.repository.update(todo!.id, patch);

    const snapshot = await device.repository.load();

    expect(snapshot.status.pending).toBe(1);
    expect(snapshot.todos[0]).toMatchObject(patch);
  });

  it("doesn't schedule a write for an update that changes nothing", async () => {
    const { device, id } = await synced();

    device.alarms.create.mockClear();
    await device.repository.update(id, { text: "Task", done: false });

    expect(device.alarms.create).not.toHaveBeenCalled();
  });

  it("updates a device-only to-do on the device, with nothing to send to sync", async () => {
    const device = createDevice();

    device.local.data.set(todoKey("dv"), rec("Device", "a1"));
    await device.repository.update("dv", { text: "Changed" });

    expect((await device.repository.load()).status.pending).toBe(0);
    expect(keys(device.local)).toEqual(["outbox", todoKey("dv")]);
    expect(device.local.data.get(todoKey("dv"))).toMatchObject({ t: "Changed" });
  });

  it("writes a to-do waiting in the queue to the device once sync turns out to be off", async () => {
    const device = createDevice();

    device.local.data.set("outbox", { qd: put(rec("Queued", "a1")) });
    vi.spyOn(device.sync, "get").mockRejectedValue(new Error("storage.sync is disabled"));

    await device.repository.update("qd", { done: true });

    expect(device.local.data.get(todoKey("qd"))).toMatchObject({ t: "Queued", d: 1 });
    expect(device.local.data.get("outbox")).toEqual({});
  });
});

describe("removing", () => {
  it("writes nothing when the to-do doesn't exist", async () => {
    const device = createDevice();

    expect(await device.repository.remove("missing")).toBeNull();
    expect(keys(device.local)).toEqual([]);
    expect(device.alarms.create).not.toHaveBeenCalled();
  });

  it("keeps the removed copy in the trash", async () => {
    const device = createDevice();
    const todo = await device.repository.add("Gone");

    await device.repository.remove(todo.id);

    expect(device.local.data.get(trashKey(todo.id))).toMatchObject({ t: "Gone", x: NOW });
  });

  it("replaces an older copy in the trash with the newly removed one", async () => {
    const device = createDevice();

    device.sync.data.set(todoKey("tw"), rec("Twice", "a1", { u: 7 }));
    device.local.data.set(trashKey("tw"), { ...rec("Twice", "a1"), x: 5 });

    await device.repository.remove("tw");

    expect(device.local.data.get(trashKey("tw"))).toMatchObject({ u: 7, x: NOW });
  });

  it("deletes a device-only to-do from the device", async () => {
    const device = createDevice();

    device.local.data.set(todoKey("dv"), rec("Device", "a1"));
    await device.repository.remove("dv");

    expect(device.local.data.has(todoKey("dv"))).toBe(false);
    expect((await device.repository.load()).todos).toEqual([]);
  });

  it("does nothing on an empty trash", async () => {
    const device = createDevice();
    const remove = vi.spyOn(device.local, "remove");

    expect(await device.repository.emptyTrash()).toBe(0);
    expect(remove).not.toHaveBeenCalled();
  });

  it("purges trashed to-dos only once they are older than the retention period", async () => {
    const device = createDevice();

    device.local.data.set(trashKey("old"), { ...rec("Old", "a1"), x: NOW - TRASH_RETENTION_MS - 1 });
    device.local.data.set(trashKey("edge"), { ...rec("Edge", "a2"), x: NOW - TRASH_RETENTION_MS });

    await device.repository.flush();

    expect((await device.repository.load()).trash.map(todo => todo.id)).toEqual(["edge"]);
  });
});

describe("documents", () => {
  it("writes only the outbox when saving lists or settings", async () => {
    const device = createDevice();

    await device.repository.saveLists(lists(1));
    await device.repository.savePrefs({ skin: "chalk" });

    expect(keys(device.local)).toEqual(["outbox"]);
  });

  it("saves lists straight to the device when sync is off", async () => {
    const device = createDevice({ noSync: true });

    await device.repository.saveLists(lists(1));

    expect(device.local.data.get("lists")).toEqual(encodeLists(lists(1)));
    expect(device.local.data.get("outbox")).toEqual({});
    expect((await device.repository.load()).lists).toEqual(lists(1));
  });
});

describe("importing", () => {
  const backupTodo = decodeTodo("imp", rec("Imported", "a5"), "sync");

  it("queues an imported to-do for sync and writes nothing else to the device", async () => {
    const device = createDevice();

    await device.repository.importData({ todos: [backupTodo], lists: [], prefs: null }, "merge");

    expect(keys(device.local)).toEqual(["outbox"]);
    expect((await device.repository.load()).todos).toMatchObject([{ id: "imp", location: "sync", pending: true }]);
  });

  it("replaces a to-do that has the same ID as one in the backup", async () => {
    const device = createDevice();

    await device.repository.restore([{ ...backupTodo, text: "Mine" }]);

    const result = await device.repository.importData({ todos: [backupTodo], lists: [], prefs: null }, "replace");

    expect(result).toEqual({ added: 1, skipped: 0, trashed: 1 });
    expect((await device.repository.load()).todos.map(todo => todo.text)).toEqual(["Imported"]);
  });

  it("takes the backup's lists when replacing", async () => {
    const device = createDevice();

    await device.repository.saveLists(lists(1, "mine"));
    await device.repository.importData({ todos: [], lists: lists(1, "theirs"), prefs: null }, "replace");

    expect((await device.repository.load()).lists).toEqual(lists(1, "theirs"));
  });

  it("adds only the lists that aren't here yet when merging", async () => {
    const device = createDevice();
    const mine = { id: "same", name: "Mine", emoji: null };

    await device.repository.saveLists([mine]);
    await device.repository.importData({ todos: [], lists: [{ ...mine, name: "Theirs" }, ...lists(1)], prefs: null }, "merge");
    await device.repository.flush();

    expect(device.sync.data.get("lists")).toEqual(encodeLists([mine, ...lists(1)]));
  });

  it("stores no more than the list limit when merging", async () => {
    const device = createDevice();

    await device.repository.saveLists(lists(MAX_LISTS));
    await device.repository.importData({ todos: [], lists: lists(1, "extra"), prefs: null }, "merge");
    await device.repository.flush();

    expect(device.sync.data.get("lists")).toEqual(encodeLists(lists(MAX_LISTS)));
  });

  it("keeps the current settings when merging", async () => {
    const device = createDevice();

    await device.repository.importData({ todos: [], lists: [], prefs: { ...DEFAULT_PREFS, skin: "chalk" } }, "merge");

    expect((await device.repository.load()).prefs.skin).toBe(DEFAULT_PREFS.skin);
  });

  it("leaves the settings alone when replacing with a backup that has none", async () => {
    const device = createDevice();

    await device.repository.importData({ todos: [], lists: [], prefs: null }, "replace");
    await device.repository.flush();

    expect(device.sync.data.has("prefs")).toBe(false);
  });
});

describe("reading both areas", () => {
  it("shows the sync copy when both copies are equally recent", async () => {
    const device = createDevice();

    device.sync.data.set(todoKey("tw"), rec("Synced", "a1", { u: 5 }));
    device.local.data.set(todoKey("tw"), rec("Device", "a1", { u: 5 }));

    expect((await device.repository.load()).todos).toMatchObject([{ text: "Synced", location: "sync" }]);
  });

  it("counts synced, device-only and kept to-dos", async () => {
    const device = createDevice();

    device.sync.data.set(todoKey("s1"), rec("S1", "a1"));
    device.sync.data.set(todoKey("s2"), rec("S2", "a2"));
    device.local.data.set(todoKey("d1"), rec("D1", "a3"));
    device.local.data.set(todoKey("k1"), rec("K1", "a4", { k: 1 }));

    expect((await device.repository.load()).status).toMatchObject({ synced: 2, deviceOnly: 2, keptOnDevice: 1 });
  });

  it("reports sync usage as it will be once the queue is written", async () => {
    const device = createDevice();
    const a = rec("A", "a1");
    const b = rec("B", "a2");
    const b2 = rec("B, longer now", "a2");
    const d = rec("D", "a3");
    const listsDoc = encodeLists(lists(2));

    device.sync.data.set("meta", { v: 2 });
    device.sync.data.set(todoKey("a"), a);
    device.sync.data.set(todoKey("b"), b);
    device.local.data.set("outbox", {
      "a": DELETE,
      "c": DELETE,
      "e": DELETE,
      "b": put(b2),
      "d": put(d),
      "@lists": doc(listsDoc),
    });

    const bytes = areaBytes(Object.fromEntries(device.sync.data))
      - itemBytes(todoKey("a"), a)
      + itemBytes(todoKey("b"), b2) - itemBytes(todoKey("b"), b)
      + itemBytes(todoKey("d"), d)
      + itemBytes("lists", listsDoc);
    const items = 4;

    expect((await device.repository.load()).status.usage).toEqual({
      bytes,
      quotaBytes: DEFAULT_SYNC_LIMITS.quotaBytes,
      items,
      maxItems: DEFAULT_SYNC_LIMITS.maxItems,
      ratio: Math.max(bytes / DEFAULT_SYNC_LIMITS.quotaBytes, items / DEFAULT_SYNC_LIMITS.maxItems),
    });
  });

  it("stays on the device once sync turns out to be unavailable", async () => {
    const device = createDevice();

    vi.spyOn(device.sync, "get").mockRejectedValueOnce(new Error("storage.sync is disabled"));

    expect((await device.repository.load()).status.mode).toBe("local");
    expect((await device.repository.load()).status.mode).toBe("local");
  });
});

describe("flushing", () => {
  it("writes nothing when there is nothing to write", async () => {
    const device = createDevice();

    device.sync.data.set("meta", { v: 2 });

    const syncSet = vi.spyOn(device.sync, "set");
    const syncRemove = vi.spyOn(device.sync, "remove");
    const localSet = vi.spyOn(device.local, "set");
    const localRemove = vi.spyOn(device.local, "remove");

    await device.repository.flush();

    expect(syncSet).not.toHaveBeenCalled();
    expect(syncRemove).not.toHaveBeenCalled();
    expect(localRemove).not.toHaveBeenCalled();
    expect(localSet).toHaveBeenCalledTimes(1);
    expect(localSet).toHaveBeenCalledWith({ outbox: {} });
  });

  it("upgrades an older schema marker", async () => {
    const device = createDevice();

    device.sync.data.set("meta", { v: 1 });
    await device.repository.flush();

    expect(device.sync.data.get("meta")).toEqual({ v: 2 });
  });

  it("only removes from sync when only removals are queued", async () => {
    const device = createDevice();
    const todo = await device.repository.add("Gone");

    await device.repository.flush();
    await device.repository.remove(todo.id);

    const syncSet = vi.spyOn(device.sync, "set");

    await device.repository.flush();

    expect(syncSet).not.toHaveBeenCalled();
    expect(device.sync.data.has(todoKey(todo.id))).toBe(false);
  });

  it("counts a write and a removal in one flush as two writes", async () => {
    // Three writes a minute (90% of four).
    const device = withLimits({ writesPerMinute: 4 });
    const a = await device.repository.add("A");

    await device.repository.flush();
    await device.repository.remove(a.id);
    await device.repository.add("B");
    await device.repository.flush();
    await device.repository.add("C");
    await device.repository.flush();

    const { status } = await device.repository.load();

    expect(status.retryAt).not.toBeNull();
    expect(status.pending).toBe(1);
  });

  it("writes queued to-dos in list order, so the first ones get the room", async () => {
    // Three keys: the schema marker and two to-dos.
    const device = withLimits({ maxItems: SAFETY.reservedItems + 3 });

    device.sync.data.set("meta", { v: 2 });
    device.local.data.set("outbox", { c: put(rec("C", "a3")), a: put(rec("A", "a1")), b: put(rec("B", "a2")) });
    await device.repository.flush();

    expect(keys(device.sync)).toEqual(["meta", todoKey("a"), todoKey("b")]);
    expect(device.local.data.has(todoKey("c"))).toBe(true);
  });

  it("moves device-only to-dos to sync in list order, so the first ones get the room", async () => {
    const device = withLimits({ maxItems: SAFETY.reservedItems + 3 });

    device.sync.data.set("meta", { v: 2 });
    device.local.data.set(todoKey("z"), rec("Z", "a3"));
    device.local.data.set(todoKey("x"), rec("X", "a1"));
    device.local.data.set(todoKey("y"), rec("Y", "a2"));
    await device.repository.flush();

    expect(keys(device.sync)).toEqual(["meta", todoKey("x"), todoKey("y")]);
    expect(keys(device.local)).toEqual(["outbox", todoKey("z")]);
  });

  it("syncs a queued to-do exactly as big as a sync item may be, and no bigger", async () => {
    const record = rec("Sized", "a1");
    const size = itemBytes(todoKey("sz"), record);

    for (const [limit, synced] of [[size, true], [size - 1, false]] as const) {
      const device = withLimits({ quotaBytesPerItem: limit });

      device.local.data.set("outbox", { sz: put(record) });
      await device.repository.flush();

      expect(device.sync.data.has(todoKey("sz"))).toBe(synced);
      expect(device.local.data.has(todoKey("sz"))).toBe(!synced);
    }
  });

  it("keeps the newer copy of a to-do left in both areas", async () => {
    const cases = [
      { device: 4, kept: "sync" },
      { device: 5, kept: "sync" },
      { device: 6, kept: "device" },
    ];

    for (const { device: updatedAt, kept } of cases) {
      const device = createDevice();

      device.sync.data.set("meta", { v: 2 });
      device.sync.data.set(todoKey("tw"), rec("Synced", "a1", { u: 5 }));
      device.local.data.set(todoKey("tw"), rec("Device", "a1", { u: updatedAt }));
      await device.repository.flush();

      expect([device.sync.data.has(todoKey("tw")), device.local.data.has(todoKey("tw"))]).toEqual([kept === "sync", kept === "device"]);
    }
  });

  it("moves pending to-dos to the device when sync is off, and keeps removals queued", async () => {
    const device = createDevice({ noSync: true });
    const listsDoc = encodeLists(lists(1));

    device.local.data.set("outbox", { "qa": put(rec("Queued", "a1")), "@lists": doc(listsDoc), "zz": DELETE });
    await device.repository.flush();

    expect(keys(device.local)).toEqual(["lists", "outbox", todoKey("qa")]);
    expect(device.local.data.get("outbox")).toEqual({ zz: DELETE });
    expect(device.local.data.get("lists")).toEqual(listsDoc);
  });

  it("keeps new and device-only to-dos on the device after sync reports it is full", async () => {
    const device = createDevice();
    const old = await device.repository.add("Old");

    await device.repository.flush();
    await device.repository.update(old.id, { text: "Old, edited" });

    const fresh = await device.repository.add("New");

    device.local.data.set(todoKey("dv"), rec("Device-only", "a0"));
    vi.spyOn(device.sync, "set").mockRejectedValueOnce(new Error("QUOTA_BYTES quota exceeded"));
    await device.repository.flush();

    expect(device.local.data.has(todoKey("dv"))).toBe(true);
    expect(device.sync.data.has(todoKey("dv"))).toBe(false);

    expect(device.sync.data.get(todoKey(old.id))).toMatchObject({ t: "Old, edited" });
    expect(device.local.data.has(todoKey(fresh.id))).toBe(true);
    expect(device.sync.data.has(todoKey(fresh.id))).toBe(false);
  });

  it("stops using sync after a write says it is unavailable", async () => {
    const device = createDevice();

    await device.repository.add("Local now");
    vi.spyOn(device.sync, "set").mockRejectedValueOnce(new Error("storage.sync is disabled"));
    await device.repository.flush();

    const snapshot = await device.repository.load();

    expect(snapshot.status.mode).toBe("local");
    expect(snapshot.todos).toMatchObject([{ text: "Local now", location: "device" }]);
  });

  it("warns and retries a minute later after an unknown write failure", async () => {
    const device = createDevice();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = new Error("boom");

    await device.repository.add("Retry");
    vi.spyOn(device.sync, "set").mockRejectedValueOnce(error);
    await device.repository.flush();

    expect(warn).toHaveBeenCalledWith("[swift-todo] Sync write failed, retrying later.", error);
    expect((await device.repository.load()).status.retryAt).toBe(NOW + 60_000);
  });
});

describe("flush timers", () => {
  it("cancels the scheduled flush when flushing by hand", async () => {
    const device = createDevice();

    await device.repository.add("A");
    await device.repository.flush();
    expect(device.alarms.clear).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(FLUSH_DEBOUNCE_MS);
    await idle(device);

    expect(device.alarms.clear).toHaveBeenCalledTimes(1);
  });

  it("waits for a quiet period after the last change before flushing", async () => {
    const device = createDevice();

    await device.repository.add("A");
    vi.advanceTimersByTime(FLUSH_DEBOUNCE_MS - 100);
    await device.repository.add("B");
    vi.advanceTimersByTime(100);
    await idle(device);

    expect((await device.repository.load()).status.pending).toBe(2);

    vi.advanceTimersByTime(FLUSH_DEBOUNCE_MS);
    await idle(device);

    expect((await device.repository.load()).status.pending).toBe(0);
  });

  it("flushes once after several quick changes", async () => {
    const device = createDevice();

    await device.repository.add("A");
    await device.repository.add("B");

    vi.advanceTimersByTime(FLUSH_DEBOUNCE_MS);
    await idle(device);

    expect((await device.repository.load()).status.pending).toBe(0);
    expect(device.alarms.clear).toHaveBeenCalledTimes(1);
  });

  it("retries on its own once the write budget frees up", async () => {
    const device = withLimits({ writesPerMinute: 1 });

    await device.repository.add("A");
    await device.repository.flush();
    await device.repository.add("B");
    await device.repository.flush();

    expect((await device.repository.load()).status).toMatchObject({ pending: 1, retryAt: NOW + 60_000 });
    expect(device.alarms.create).toHaveBeenLastCalledWith(FLUSH_ALARM, { delayInMinutes: 1 });

    device.clock.now += 60_000;
    vi.advanceTimersByTime(60_000);
    await idle(device);

    expect((await device.repository.load()).status).toMatchObject({ pending: 0, retryAt: null });
  });

  it("keeps only the retry timer when a change lands while the write budget is used up", async () => {
    const device = withLimits({ writesPerMinute: 1 });

    await device.repository.add("A");
    await device.repository.flush();
    await Promise.all([device.repository.add("B"), device.repository.flush()]);

    expect((await device.repository.load()).status.retryAt).toBe(NOW + 60_000);

    const scheduled = device.alarms.create.mock.calls.length;

    vi.advanceTimersByTime(FLUSH_DEBOUNCE_MS);
    await idle(device);

    expect(device.alarms.create).toHaveBeenCalledTimes(scheduled);
  });

  it("logs a background flush that fails", async () => {
    const device = createDevice();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("boom");

    await device.repository.add("A");
    vi.spyOn(device.sync, "get").mockRejectedValue(failure);
    vi.advanceTimersByTime(FLUSH_DEBOUNCE_MS);

    await vi.waitFor(() => expect(error).toHaveBeenCalledWith("[swift-todo] Could not write pending changes.", failure));
  });
});

// Planning a flush: each case checks that a to-do (the probe, last in the list)
// goes to sync when it fits exactly, and stays on the device one byte or one key short.
describe("sync space accounting", () => {
  type TScenario = (device: TDevice, pad: string) => void;

  const PROBE = "zz";

  function probe(pad: string): TTodoRecord {
    return rec(`Probe${pad}`, "z");
  }

  async function run(scenario: TScenario, limits: Partial<TSyncLimits>, pad = ""): Promise<TDevice> {
    const device = withLimits(limits);

    scenario(device, pad);
    await device.repository.flush();

    return device;
  }

  async function probeSynced(scenario: TScenario, limits: Partial<TSyncLimits>, pad = ""): Promise<boolean> {
    const device = await run(scenario, limits, pad);

    return device.sync.data.has(todoKey(PROBE)) && !device.local.data.has(todoKey(PROBE));
  }

  // Finds a quota whose `ratio` share is exactly what sync ends up holding, padding the probe until there is one.
  async function exactQuota(scenario: TScenario, ratio: number, limits: Partial<TSyncLimits>): Promise<{ quota: number; pad: string }> {
    for (let length = 0; length < 100; length++) {
      const pad = "p".repeat(length);
      const device = await run(scenario, { ...limits, ...LOOSE }, pad);
      const bytes = areaBytes(Object.fromEntries(device.sync.data));
      const quota = Math.round(bytes / ratio);

      if (quota * ratio === bytes) {
        return { quota, pad };
      }
    }

    throw new Error("No exact quota found.");
  }

  async function expectByteBoundary(scenario: TScenario, ratio: number = SAFETY.quotaRatio, limits: Partial<TSyncLimits> = {}): Promise<void> {
    const { quota, pad } = await exactQuota(scenario, ratio, limits);

    expect(await probeSynced(scenario, { ...limits, quotaBytes: quota }, pad)).toBe(true);
    expect(await probeSynced(scenario, { ...limits, quotaBytes: quota - 1 }, pad)).toBe(false);
  }

  async function expectItemBoundary(scenario: TScenario, limits: Partial<TSyncLimits> = {}): Promise<void> {
    const items = (await run(scenario, { ...limits, ...LOOSE })).sync.data.size;

    expect(await probeSynced(scenario, { ...limits, maxItems: items + SAFETY.reservedItems })).toBe(true);
    expect(await probeSynced(scenario, { ...limits, maxItems: items + SAFETY.reservedItems - 1 })).toBe(false);
  }

  const fresh: TScenario = (device, pad) => {
    device.local.data.set("outbox", { "@prefs": doc({ skin: "chalk" }), [PROBE]: put(probe(pad)) });
  };

  const staleMeta: TScenario = (device, pad) => {
    device.sync.data.set("meta", "x".repeat(40));
    device.local.data.set("outbox", { [PROBE]: put(probe(pad)) });
  };

  const replacedDoc: TScenario = (device, pad) => {
    device.sync.data.set("meta", { v: 2 });
    device.sync.data.set("lists", encodeLists(lists(6)));
    device.local.data.set("outbox", { "@lists": doc(encodeLists(lists(1))), [PROBE]: put(probe(pad)) });
  };

  const deletions: TScenario = (device, pad) => {
    device.sync.data.set("meta", { v: 2 });
    device.sync.data.set(todoKey("d1"), rec("Deleted".repeat(5), "a1"));
    device.local.data.set("outbox", { d1: DELETE, d2: DELETE, [PROBE]: put(probe(pad)) });
  };

  const updates: TScenario = (device, pad) => {
    device.sync.data.set("meta", { v: 2 });
    device.sync.data.set(todoKey("up"), rec("Updated".repeat(4), "a1"));
    device.local.data.set("outbox", { up: put(rec("Updated".repeat(6), "a1")), nw: put(rec("New", "a2")), [PROBE]: put(probe(pad)) });
  };

  const grown: TScenario = (device, pad) => {
    device.sync.data.set("meta", { v: 2 });
    device.sync.data.set(todoKey(PROBE), rec("Small".repeat(10), "z"));
    device.local.data.set("outbox", { [PROBE]: put(rec(`Bigger${"g".repeat(60)}${pad}`, "z")) });
  };

  // With a 150-byte item limit, "Huge" never fits in sync.
  const ITEM_LIMIT = { quotaBytesPerItem: 150 };

  const demotedNew: TScenario = (device, pad) => {
    device.sync.data.set("meta", { v: 2 });
    device.local.data.set("outbox", { big: put(rec("Huge".repeat(40), "a1")), [PROBE]: put(probe(pad)) });
  };

  const demotedSynced: TScenario = (device, pad) => {
    device.sync.data.set("meta", { v: 2 });
    device.sync.data.set(todoKey("gr"), rec("Grew".repeat(10), "a1"));
    device.local.data.set("outbox", { gr: put(rec("Huge".repeat(40), "a1")), [PROBE]: put(probe(pad)) });
  };

  const promoted: TScenario = (device, pad) => {
    device.sync.data.set("meta", { v: 2 });
    device.local.data.set(todoKey("p1"), rec("Promoted".repeat(3), "a1"));
    device.local.data.set(todoKey(PROBE), probe(pad));
  };

  it("counts the schema marker and a new document in a fresh sync area", async () => {
    expect(keys((await run(fresh, LOOSE)).sync)).toEqual(["meta", "prefs", todoKey(PROBE)]);
    await expectByteBoundary(fresh);
    await expectItemBoundary(fresh);
  });

  it("counts a malformed schema marker being replaced", async () => {
    expect((await run(staleMeta, LOOSE)).sync.data.get("meta")).toEqual({ v: 2 });
    await expectByteBoundary(staleMeta);
    await expectItemBoundary(staleMeta);
  });

  it("counts a document being replaced", async () => {
    await expectByteBoundary(replacedDoc);
    await expectItemBoundary(replacedDoc);
  });

  it("counts the space queued removals free, and ignores removals of what is already gone", async () => {
    const device = withLimits(LOOSE);
    const removed = vi.spyOn(device.sync, "remove");

    deletions(device, "");
    await device.repository.flush();

    expect(removed).toHaveBeenCalledWith([todoKey("d1")]);
    await expectByteBoundary(deletions);
    await expectItemBoundary(deletions);
  });

  it("counts updated and new to-dos queued ahead", async () => {
    await expectByteBoundary(updates);
    await expectItemBoundary(updates);
  });

  it("counts a synced to-do that grew by its new size only", async () => {
    await expectByteBoundary(grown);
  });

  it("counts no space for a new to-do kept on the device", async () => {
    const device = await run(demotedNew, { ...ITEM_LIMIT, ...LOOSE });

    expect(device.local.data.has(todoKey("big"))).toBe(true);
    await expectItemBoundary(demotedNew, ITEM_LIMIT);
  });

  it("counts the space freed by a synced to-do that moves to the device", async () => {
    const device = await run(demotedSynced, { ...ITEM_LIMIT, ...LOOSE });

    expect(device.sync.data.has(todoKey("gr"))).toBe(false);
    expect(device.local.data.has(todoKey("gr"))).toBe(true);
    await expectByteBoundary(demotedSynced, SAFETY.quotaRatio, ITEM_LIMIT);
    await expectItemBoundary(demotedSynced, ITEM_LIMIT);
  });

  it("moves device-only to-dos to sync while usage stays under the promotion share", async () => {
    await expectByteBoundary(promoted, SAFETY.promoteRatio);
    await expectItemBoundary(promoted);
  });
});
