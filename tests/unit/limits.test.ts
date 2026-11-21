import { describe, expect, it } from "vitest";

import { classifyStorageError, TodoError } from "~/lib/todos/errors";
import { DEFAULT_SYNC_LIMITS, resolveSyncLimits } from "~/lib/todos/limits";
import { areaBytes, itemBytes } from "~/lib/todos/size";
import { WriteBudget } from "~/lib/todos/write-budget";

import { memoryArea } from "./helpers";



describe("resolveSyncLimits", () => {
  it("uses the browser's values and falls back to the defaults", () => {
    expect(resolveSyncLimits(undefined)).toEqual(DEFAULT_SYNC_LIMITS);
    expect(resolveSyncLimits({ QUOTA_BYTES: 2048, MAX_ITEMS: "nope" })).toEqual({ ...DEFAULT_SYNC_LIMITS, quotaBytes: 2048 });
  });
});

describe("size", () => {
  it("counts the key plus the JSON value in UTF-8 bytes", () => {
    expect(itemBytes("ab", "c")).toBe(2 + 3);
    expect(itemBytes("k", "é")).toBe(1 + 4);
    expect(areaBytes({ a: 1, bb: [1, 2] })).toBe(2 + 7);
  });
});

describe("classifyStorageError", () => {
  it.each([
    ["MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded", "rate-limit"],
    ["MAX_WRITE_OPERATIONS_PER_HOUR quota exceeded", "rate-limit"],
    ["QUOTA_BYTES quota exceeded", "quota"],
    ["QUOTA_BYTES_PER_ITEM quota exceeded", "quota"],
    ["MAX_ITEMS quota exceeded", "quota"],
    // Messages observed in Chromium 159 while testing the built extension.
    ["Resource::kQuotaBytes quota exceeded", "quota"],
    ["This request exceeds the MAX_WRITE_OPERATIONS_PER_MINUTE quota.", "rate-limit"],
    // Same naming style, for the variants that weren't triggered.
    ["Resource::kQuotaBytesPerItem quota exceeded", "quota"],
    ["Resource::kMaxItems quota exceeded", "quota"],
    ["Resource::kMaxWriteOperationsPerHour quota exceeded", "rate-limit"],
    ["QuotaExceededError: storage.sync API call exceeded its quota limitations.", "quota"],
    ["Please set webextensions.storage.sync.enabled to true in about:config", "unavailable"],
    ["The storage API will not work with a temporary addon ID.", "unavailable"],
    ["Something else broke", "unknown"],
  ])("classifies %j as %s", (message, expected) => {
    expect(classifyStorageError(new Error(message))).toBe(expected);
  });

  it("exposes the refusal code on TodoError", () => {
    expect(new TodoError("empty").code).toBe("empty");
  });
});

describe("writeBudget", () => {
  const limits = { writesPerMinute: 10, writesPerHour: 30 };

  it("allows writes up to 90% of the per-minute limit, then asks to wait", async () => {
    const clock = { now: 0 };
    const budget = new WriteBudget(memoryArea("session"), limits, () => clock.now);

    for (let i = 0; i < 9; i++) {
      clock.now = i * 1000;
      expect(await budget.reserve(1)).toBe(0);
    }

    clock.now = 9000;
    expect(await budget.reserve(1)).toBe(51_000);

    clock.now = 60_001;
    expect(await budget.reserve(1)).toBe(0);
  });

  it("enforces the per-hour limit across minutes", async () => {
    const clock = { now: 0 };
    const budget = new WriteBudget(memoryArea("session"), limits, () => clock.now);

    for (let i = 0; i < 27; i++) {
      clock.now = i * 61_000;
      expect(await budget.reserve(1)).toBe(0);
    }

    clock.now = 27 * 61_000;
    expect(await budget.reserve(1)).toBe(3_600_000 - clock.now);
  });

  it("shares its log with every budget on the same area", async () => {
    const area = memoryArea("session");
    const popup = new WriteBudget(area, limits, () => 0);
    const background = new WriteBudget(area, limits, () => 0);

    expect(await popup.reserve(5)).toBe(0);
    expect(await background.reserve(4)).toBe(0);
    expect(await popup.reserve(1)).toBeGreaterThan(0);
  });
});
