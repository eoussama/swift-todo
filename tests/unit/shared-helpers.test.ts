import { describe, expect, it } from "vitest";

import { timerLengths } from "~/lib/prefs/prefs";
import { addMonths, daysInMonth, isClockTime, nextAt } from "~/lib/time/date";
import { listLabel } from "~/lib/todos/lists";
import { syncStateOf } from "~/lib/todos/model";
import { BUILT_IN_FILTERS, INBOX, listOf } from "~/lib/todos/view";
import { isOneOf, same } from "~/lib/values";



describe("helpers shared across the extension", () => {
  it("tells where a to-do stands with sync", () => {
    expect(syncStateOf({ location: "sync", pending: false, keepOnDevice: false }, false)).toBe("unavailable");
    expect(syncStateOf({ location: "sync", pending: false, keepOnDevice: false }, true)).toBe("synced");
    expect(syncStateOf({ location: "sync", pending: true, keepOnDevice: false }, true)).toBe("pending");
    expect(syncStateOf({ location: "device", pending: false, keepOnDevice: true }, true)).toBe("kept");
    expect(syncStateOf({ location: "device", pending: false, keepOnDevice: false }, true)).toBe("waiting");
  });

  it("gives the pickers' Inbox the name of the Inbox view", () => {
    expect(BUILT_IN_FILTERS).toContain(INBOX);
    expect(listOf({ list: INBOX }, [])).toBeNull();
  });

  it("names a list after its emoji", () => {
    expect(listLabel({ name: "Home", emoji: "🏠" })).toBe("🏠 Home");
    expect(listLabel({ name: "Home", emoji: null })).toBe("Home");
  });

  it("offers the timer lengths with the chosen one, shortest first", () => {
    expect(timerLengths(25)).toEqual([5, 15, 25, 50]);
    expect(timerLengths(40)).toEqual([5, 15, 25, 40, 50]);
    expect(timerLengths(90)).toEqual([5, 15, 25, 50, 90]);
  });

  it("tells a whole time from one still being typed", () => {
    expect(isClockTime("09:30")).toBe(true);
    expect(isClockTime("9:30")).toBe(false);
    expect(isClockTime("09:3")).toBe(false);
    expect(isClockTime("x09:30")).toBe(false);
    expect(isClockTime("09:30x")).toBe(false);
  });

  it("counts the days of a month, and lands on a given day when adding months", () => {
    expect(daysInMonth(new Date(2027, 1, 10))).toBe(28);
    expect(daysInMonth(new Date(2028, 1, 1))).toBe(29);
    expect(daysInMonth(new Date(2027, 0, 31))).toBe(31);
    expect(addMonths(new Date(2027, 1, 28), 1, 31)).toEqual(new Date(2027, 2, 31));
    expect(addMonths(new Date(2027, 0, 31), 1, 30)).toEqual(new Date(2027, 1, 28));
    expect(addMonths(new Date(2027, 0, 15), 1)).toEqual(new Date(2027, 1, 15));
  });

  it("finds the next time a clock time comes", () => {
    const now = new Date(2026, 10, 21, 10, 30);

    expect(nextAt(11, 0, now)).toEqual(new Date(2026, 10, 21, 11, 0));
    expect(nextAt(10, 30, now)).toEqual(new Date(2026, 10, 22, 10, 30));
    expect(nextAt(9, 0, now)).toEqual(new Date(2026, 10, 22, 9, 0));
  });

  it("checks values against a fixed set, and compares stored values", () => {
    expect(isOneOf(["a", "b"], "b")).toBe(true);
    expect(isOneOf(["a", "b"], "c")).toBe(false);
    expect(isOneOf(["a", "b"], 1)).toBe(false);
    expect(same({ a: [1, 2] }, { a: [1, 2] })).toBe(true);
    expect(same({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
  });
});
