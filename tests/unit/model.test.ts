import { describe, expect, it } from "vitest";

import { TODO_LIMITS } from "~/lib/todos/limits";
import { compareTodos, createId, decodeTodo, encodeTodo, idFromKey, isTodoRecord, normalizeText, readRecords, todoKey } from "~/lib/todos/model";



describe("normalizeText", () => {
  it("trims and folds whitespace and line breaks", () => {
    expect(normalizeText("  buy\n\tmilk   now ")).toBe("buy milk now");
  });

  it("returns an empty string for blank text", () => {
    expect(normalizeText(" \n ")).toBe("");
  });

  it("cuts long text to the maximum length", () => {
    expect(normalizeText("a".repeat(TODO_LIMITS.maxTextLength + 50))).toHaveLength(TODO_LIMITS.maxTextLength);
  });

  it("never splits a character made of two code units", () => {
    const text = `${"a".repeat(TODO_LIMITS.maxTextLength - 1)}😀`;
    const result = normalizeText(text);

    expect(result.length).toBeLessThanOrEqual(TODO_LIMITS.maxTextLength);
    expect(result.endsWith("\uD83D")).toBe(false);
  });
});

describe("keys", () => {
  it("round-trips IDs through keys", () => {
    const id = createId();

    expect(id).toMatch(/^[0-9a-z]{10}$/);
    expect(idFromKey(todoKey(id))).toBe(id);
  });

  it("ignores keys that aren't to-dos", () => {
    expect(idFromKey("meta")).toBeNull();
    expect(idFromKey("t:")).toBeNull();
  });
});

describe("records", () => {
  const todo = { text: "Write tests", done: true, position: "a0", createdAt: 1, updatedAt: 2 };

  it("encodes compactly and decodes back", () => {
    const record = encodeTodo(todo);

    expect(record).toEqual({ t: "Write tests", d: 1, p: "a0", c: 1, u: 2 });
    expect(decodeTodo("x", record, "sync")).toEqual({ ...todo, id: "x", location: "sync", keepOnDevice: false, pending: false });
  });

  it("stores the keep-on-device choice only when set, and only honors it on the device", () => {
    const record = encodeTodo({ ...todo, keepOnDevice: true });

    expect(record.k).toBe(1);
    expect(encodeTodo({ ...todo, keepOnDevice: false })).not.toHaveProperty("k");
    expect(decodeTodo("x", record, "device").keepOnDevice).toBe(true);
    expect(decodeTodo("x", record, "sync").keepOnDevice).toBe(false);
    expect(isTodoRecord({ ...record, k: 2 })).toBe(false);
  });

  it("rejects malformed records", () => {
    expect(isTodoRecord({ t: "x", d: 1, p: "a0", c: 1, u: 2 })).toBe(true);
    expect(isTodoRecord({ t: "x", d: true, p: "a0", c: 1, u: 2 })).toBe(false);
    expect(isTodoRecord({ t: "x", d: 0, p: "", c: 1, u: 2 })).toBe(false);
    expect(isTodoRecord(null)).toBe(false);
  });

  it("reads only well-formed to-do entries from an area", () => {
    const records = readRecords({
      "meta": { v: 1 },
      "t:good": { t: "x", d: 0, p: "a0", c: 1, u: 1 },
      "t:bad": { t: 1 },
    });

    expect([...records.keys()]).toEqual(["good"]);
  });
});

describe("compareTodos", () => {
  it("sorts by position, then creation time, then ID", () => {
    const list = [
      { id: "b", position: "a1", createdAt: 1 },
      { id: "c", position: "a0", createdAt: 2 },
      { id: "a", position: "a0", createdAt: 2 },
      { id: "d", position: "a0", createdAt: 1 },
    ];

    expect(list.sort(compareTodos).map(item => item.id)).toEqual(["d", "a", "c", "b"]);
  });
});
