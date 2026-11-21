import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { captureItems } from "~/lib/capture";
import { MAX_BACKUP_SIZE, parseBackup } from "~/lib/export/backup";
import { toCsv } from "~/lib/export/formats";
import { truncate } from "~/lib/messages";
import { DEFAULT_PREFS, parsePrefs } from "~/lib/prefs/prefs";
import { classifyStorageError, TodoError } from "~/lib/todos/errors";
import { DEFAULT_SYNC_LIMITS, FLUSH_ALARM, resolveSyncLimits } from "~/lib/todos/limits";
import { normalizeEmoji, normalizeListName, parseLists } from "~/lib/todos/lists";
import { withLock } from "~/lib/todos/lock";
import { isDate, isDue, isTodoRecord } from "~/lib/todos/model";
import { planMove } from "~/lib/todos/ordering";
import { collectTags, completeTag, normalizeTag, segmentText, tagQueryAt } from "~/lib/todos/tags";
import { WriteBudget } from "~/lib/todos/write-budget";

import { memoryArea } from "./helpers";



const NOW = new Date(2026, 10, 21, 10, 30);

function backup(todos: Array<unknown>, rest: Record<string, unknown> = {}): string {
  return JSON.stringify({ app: "swift-todo", version: 1, todos, ...rest });
}

describe("backup validation", () => {
  const valid = { id: "ok1", text: "Fine", position: "a0" };

  it("accepts only whole lowercase IDs up to 32 characters", () => {
    const ids = ["-abc", "abc-", "Abc", "a".repeat(33), "b".repeat(32), 5, "ok2"];
    const preview = parseBackup(backup(ids.map(id => ({ ...valid, id }))));

    expect(preview.data.todos.map(todo => todo.id)).toEqual(["b".repeat(32), "ok2"]);
  });

  it("skips entries that aren't objects without failing", () => {
    expect(parseBackup(backup([null, 7, valid])).todos).toBe(1);
  });

  it("refuses anything over the size limit, even valid JSON", () => {
    const text = backup([valid]);
    const atLimit = text.padEnd(MAX_BACKUP_SIZE, " ");

    expect(parseBackup(atLimit).todos).toBe(1);
    expect(() => parseBackup(`${atLimit} `)).toThrow(expect.objectContaining({ code: "invalid-backup" }));
    expect(() => parseBackup("{")).toThrow(expect.objectContaining({ code: "invalid-backup" }));
  });

  it("checks positions for type and length", () => {
    const at64 = `a0${"V".repeat(62)}`;
    const at65 = `a0${"V".repeat(63)}`;
    const preview = parseBackup(backup([
      { ...valid, id: "a", position: at64 },
      { ...valid, id: "b", position: at65 },
      { ...valid, id: "c", position: ["a0"] },
    ]));

    expect(preview.data.todos.map(todo => [todo.id, todo.position])).toEqual([["a", at64]]);
  });

  it("imports into sync, with a list from a single object", () => {
    const preview = parseBackup(backup([valid], { lists: { id: "solo01", name: "Solo" } }));

    expect(preview.data.todos[0]?.location).toBe("sync");
    expect(preview.data.lists.map(list => list.id)).toEqual(["solo01"]);
  });
});

describe("settings", () => {
  it("default to quiet, unobtrusive choices", () => {
    expect(DEFAULT_PREFS).toEqual({ skin: "notepad", accent: "mint", theme: "system", reminders: false, lead: 0, digest: null, nudges: false, badge: "due", timer: 25 });
  });

  it("accept numbers only within their range", () => {
    expect(parsePrefs({ lead: 0, timer: 1 })).toMatchObject({ lead: 0, timer: 1 });
    expect(parsePrefs({ lead: 1440, timer: 180 })).toMatchObject({ lead: 1440, timer: 180 });
    expect(parsePrefs({ lead: -1, timer: 0 })).toMatchObject({ lead: 0, timer: 25 });
    expect(parsePrefs({ lead: 1441, timer: 181 })).toMatchObject({ lead: 0, timer: 25 });
    expect(parsePrefs({ lead: "5", timer: 2.5 })).toMatchObject({ lead: 0, timer: 25 });
  });

  it("accept only a real digest time", () => {
    expect(parsePrefs({ digest: "09:00" }).digest).toBe("09:00");

    for (const digest of ["x09:00", "09:00x", "24:00", { toString: () => "09:00" }]) {
      expect(parsePrefs({ digest }).digest).toBeNull();
    }
  });
});

describe("tags", () => {
  it("only look at the word right before the caret", () => {
    expect(tagQueryAt("#ab cd", 6)).toBeNull();
    expect(tagQueryAt("#ab cd", 3)).toEqual({ query: "ab", start: 0 });
  });

  it("strip only a leading #", () => {
    expect(normalizeTag("#Work")).toBe("work");
    expect(normalizeTag("a#B")).toBe("a#b");
  });

  it("keep the text after the last tag", () => {
    expect(segmentText("#a tail")).toEqual([{ kind: "tag", value: "#a", tag: "a" }, { kind: "text", value: " tail" }]);
  });

  it("rank by use, then alphabetically", () => {
    expect(collectTags([{ text: "#m #z" }, { text: "#z #a" }, { text: "#b" }])).toEqual(["z", "a", "b", "m"]);
    expect(collectTags([{ text: "#b" }, { text: "#a #b" }, { text: "#a #b" }])).toEqual(["b", "a"]);
  });

  it("complete the word at the caret", () => {
    expect(completeTag("Plan #wo stuff", 5, 8, "work")).toEqual({ text: "Plan #work stuff", caret: 10 });
    expect(completeTag("Plan #wo", 5, 7, "work")).toEqual({ text: "Plan #work ", caret: 11 });
  });

  it("are separated by spaces in CSV", () => {
    const todo = { id: "a", text: "x #one #two", done: false, list: null, due: null, repeat: null, source: null } as never;

    expect(toCsv([todo], [], "Inbox").split("\r\n")[1]).toBe("Inbox,x #one #two,no,,,one two,");
  });
});

describe("sync limits", () => {
  it("name the flush alarm so the background can tell it apart", () => {
    expect(FLUSH_ALARM).toBe("swift-todo:flush");
  });

  it("use what the browser reports, when it's a positive number", () => {
    expect(resolveSyncLimits({ QUOTA_BYTES: 1000, QUOTA_BYTES_PER_ITEM: 100, MAX_ITEMS: 10, MAX_WRITE_OPERATIONS_PER_MINUTE: 5, MAX_WRITE_OPERATIONS_PER_HOUR: 50 }))
      .toEqual({ quotaBytes: 1000, quotaBytesPerItem: 100, maxItems: 10, writesPerMinute: 5, writesPerHour: 50 });

    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, "1000", null]) {
      expect(resolveSyncLimits({ QUOTA_BYTES: bad }).quotaBytes, String(bad)).toBe(DEFAULT_SYNC_LIMITS.quotaBytes);
    }
  });
});

describe("write budget windows", () => {
  const limits = { writesPerMinute: 2, writesPerHour: 2 };

  it("forget writes once they're a full window old", async () => {
    const area = memoryArea("session");
    const now = 10_000_000;
    const budget = new WriteBudget(area, limits, () => now);

    // 90% of 2 is one write per window.
    await area.set({ writeLog: [now - 3_600_000] });
    expect(await budget.reserve(1)).toBe(0);

    await area.set({ writeLog: [now - 7_200_000] });
    expect(await budget.reserve(1)).toBe(0);
  });

  it("forget writes from the minute window at exactly a minute", async () => {
    const area = memoryArea("session");
    const now = 10_000_000;
    const budget = new WriteBudget(area, { writesPerMinute: 2, writesPerHour: 100 }, () => now);

    await area.set({ writeLog: [now - 60_000] });
    expect(await budget.reserve(1)).toBe(0);
    await area.set({ writeLog: [now - 59_999] });
    expect(await budget.reserve(1)).toBe(1);
  });

  it("only count times in the log", async () => {
    const area = memoryArea("session");
    const budget = new WriteBudget(area, { writesPerMinute: 1, writesPerHour: 1 }, () => 5_000);

    await area.set({ writeLog: [4_000, null, "x"] });
    expect(await budget.reserve(1)).toBe(3_599_000);
  });
});

describe("storage errors", () => {
  it("tell rate limits, quotas and unavailable sync apart", () => {
    expect(classifyStorageError(new Error("Resource::kMaxSustainedWriteOperationsPerMinute quota exceeded"))).toBe("rate-limit");
    expect(classifyStorageError(new Error("MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE quota exceeded"))).toBe("rate-limit");
    expect(classifyStorageError(new Error("Resource::kMaxItems exceeded"))).toBe("quota");
    expect(classifyStorageError(new Error("MAX_ITEMS exceeded"))).toBe("quota");
    expect(classifyStorageError(new Error("storage sync is disabled"))).toBe("unavailable");
    expect(classifyStorageError(new Error("something else"))).toBe("unknown");
  });

  it("name refusals and keep their details", () => {
    const error = new TodoError("empty", "Nothing to add");

    expect(error.name).toBe("TodoError");
    expect(error.message).toBe("Nothing to add");
    expect(new TodoError("empty").message).toBe("empty");
  });
});

describe("toast text", () => {
  it("leaves text at the limit alone", () => {
    expect(truncate("a".repeat(40))).toBe("a".repeat(40));
    expect(truncate("a".repeat(41))).toBe(`${"a".repeat(39)}…`);
  });

  it("cuts at a word past the middle, without trailing spaces", () => {
    expect(truncate("abcd      efghijk", 10)).toBe("abcd…");
    expect(truncate("abcde fghijklm", 10)).toBe("abcde fgh…");
    expect(truncate("abcdef ghijklm", 10)).toBe("abcdef…");
  });
});

describe("lists", () => {
  it("names fold spaces before they're cut", () => {
    expect(normalizeListName("Work   stuff")).toBe("Work stuff");
    expect(normalizeListName(` ${"a".repeat(32)}`)).toBe("a".repeat(32));
    expect(normalizeListName(`${"a".repeat(31)} b`)).toBe("a".repeat(31));
  });

  it("emoji keep up to 24 units", () => {
    const longest = `a${"́".repeat(23)}`;

    expect(normalizeEmoji(longest)).toBe(longest);
  });

  it("skip entries with a name or emoji of the wrong type", () => {
    expect(parseLists([{ i: "a1", n: 5 }])).toEqual([]);
    expect(parseLists([{ i: "a1", n: "A", e: 5 }])).toEqual([{ id: "a1", name: "A", emoji: null }]);
  });
});

describe("records", () => {
  it("read dates only from strings", () => {
    expect(isDue({ toString: () => "2026-11-21" })).toBe(false);
    expect(isDate({ toString: () => "2026-11-21" })).toBe(false);
  });

  it("need a string position", () => {
    expect(isTodoRecord({ t: "x", d: 0, p: ["a0"], c: 1, u: 1 })).toBe(false);
  });
});

describe("capture", () => {
  const options = { filter: null, lists: [], source: null, now: NOW };

  it("strips list markers only at the start", () => {
    expect(captureItems("Buy milk - urgent\n10. Tenth\n-   Spaced", options).map(item => item.text)).toEqual(["Buy milk - urgent", "Tenth", "Spaced"]);
  });
});

describe("ordering ties", () => {
  type TItem = { id: string; position: string };

  function apply(list: Array<TItem>, moves: Map<string, string>): Array<TItem> {
    return list.map(item => ({ ...item, position: moves.get(item.id) ?? item.position })).sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0));
  }

  it("spreads only the tied run, between its distinct neighbors", () => {
    const list = [
      { id: "p", position: "a0" },
      { id: "q", position: "a1" },
      { id: "r", position: "a1" },
      { id: "s", position: "a1" },
      { id: "t", position: "a3" },
      { id: "x", position: "a4" },
    ];
    const moves = planMove(list, "x", 3);

    expect([...moves.keys()].sort()).toEqual(["q", "r", "s", "x"]);
    expect(apply(list, moves).map(item => item.id)).toEqual(["p", "q", "r", "x", "s", "t"]);

    for (const key of moves.values()) {
      expect(key > "a0" && key < "a3", key).toBe(true);
    }
  });

  it("widens to the right when the tie continues there", () => {
    const list = [
      { id: "p", position: "a0" },
      { id: "q", position: "a1" },
      { id: "r", position: "a1" },
      { id: "s", position: "a1" },
      { id: "t", position: "a3" },
      { id: "x", position: "a4" },
    ];
    const moves = planMove(list, "x", 2);

    expect([...moves.keys()].sort()).toEqual(["q", "r", "s", "x"]);
    expect(apply(list, moves).map(item => item.id)).toEqual(["p", "q", "x", "r", "s", "t"]);
  });
});

describe("lock", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses Web Locks when the browser has them", async () => {
    const request = vi.fn(async (_name: string, task: () => unknown) => task());

    vi.stubGlobal("navigator", { locks: { request } });
    expect(await withLock("swift-todo", () => 5)).toBe(5);
    expect(request).toHaveBeenCalledWith("swift-todo", expect.any(Function));
  });

  it("queues tasks in order without them", async () => {
    vi.stubGlobal("navigator", undefined);

    const order: Array<string> = [];
    const slow = withLock("x", async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      order.push("slow");
    });
    const fast = withLock("x", () => {
      order.push("fast");
    });
    const failing = withLock("x", () => {
      throw new Error("boom");
    });

    await Promise.all([slow, fast, failing.catch(() => order.push("failed"))]);
    expect(order).toEqual(["slow", "fast", "failed"]);
    expect(await withLock("x", () => "after")).toBe("after");
  });
});

beforeEach(() => {
  vi.useRealTimers();
});
