import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { addDays, addMonths, daysBetween, dueInstant, isDueByToday, isOverdue, nextTimeOfDay, parseDue, toDateString, toDue } from "~/lib/time/date";
import { formatDue, formatRule, weekdayNames } from "~/lib/time/format";
import { parseTodo } from "~/lib/time/parse";
import { encodeRule, firstOccurrence, nextOccurrence, parseRule } from "~/lib/time/recur";
import { completeTodo } from "~/lib/todos/complete";



// Saturday, November 21, 2026, 10:30 local time.
const NOW = new Date(2026, 10, 21, 10, 30);

describe("dates", () => {
  it("formats and reads due values in local time", () => {
    expect(toDateString(NOW)).toBe("2026-11-21");
    expect(toDue(NOW, true)).toBe("2026-11-21T10:30");
    expect(toDue(NOW, false)).toBe("2026-11-21");
    expect(parseDue("2026-11-24T15:05")).toEqual({ date: new Date(2026, 10, 24, 15, 5), hasTime: true });
    expect(parseDue("2026-11-24")).toEqual({ date: new Date(2026, 10, 24), hasTime: false });
  });

  it("treats date-only to-dos as due at 9:00", () => {
    expect(dueInstant("2026-11-24")).toBe(new Date(2026, 10, 24, 9, 0).getTime());
    expect(dueInstant("2026-11-24T15:00")).toBe(new Date(2026, 10, 24, 15, 0).getTime());
  });

  it("does calendar arithmetic", () => {
    expect(addDays(NOW, 10).getDate()).toBe(1);
    expect(toDateString(addMonths(new Date(2024, 0, 31), 1))).toBe("2024-02-29");
    expect(toDateString(addMonths(new Date(2026, 0, 31), 1))).toBe("2026-02-28");
    expect(toDateString(addMonths(new Date(2026, 10, 15), 3))).toBe("2027-02-15");
    expect(daysBetween(NOW, new Date(2026, 10, 24, 1))).toBe(3);
    expect(daysBetween(NOW, new Date(2026, 10, 20, 23))).toBe(-1);
  });

  it("knows what's overdue and what's due today", () => {
    expect(isOverdue("2026-11-21", NOW)).toBe(false);
    expect(isOverdue("2026-11-20", NOW)).toBe(true);
    expect(isOverdue("2026-11-21T10:00", NOW)).toBe(true);
    expect(isOverdue("2026-11-21T11:00", NOW)).toBe(false);
    expect(isDueByToday("2026-11-21T23:59", NOW)).toBe(true);
    expect(isDueByToday("2026-11-19", NOW)).toBe(true);
    expect(isDueByToday("2026-11-22", NOW)).toBe(false);
  });

  it("finds the next time of day", () => {
    expect(nextTimeOfDay("09:00", NOW)).toBe(new Date(2026, 10, 22, 9, 0).getTime());
    expect(nextTimeOfDay("18:15", NOW)).toBe(new Date(2026, 10, 21, 18, 15).getTime());
  });
});

describe("repeat rules", () => {
  it("reads and writes rules", () => {
    expect(parseRule("3d")).toEqual({ kind: "interval", every: 3, unit: "d" });
    expect(parseRule("45m")).toEqual({ kind: "interval", every: 45, unit: "m" });
    expect(parseRule("wd")).toEqual({ kind: "weekdays", days: [1, 2, 3, 4, 5] });
    expect(parseRule("w:3,1,3")).toEqual({ kind: "weekdays", days: [1, 3] });
    expect(parseRule("0d")).toBeNull();
    expect(parseRule("1000d")).toBeNull();
    expect(parseRule("w:7")).toBeNull();
    expect(parseRule("nope")).toBeNull();

    expect(encodeRule({ kind: "interval", every: 2.7, unit: "h" })).toBe("2h");
    expect(encodeRule({ kind: "interval", every: 5000, unit: "d" })).toBe("999d");
    expect(encodeRule({ kind: "interval", every: 0, unit: "w" })).toBe("1w");
    expect(encodeRule({ kind: "weekdays", days: [5, 4, 3, 2, 1] })).toBe("wd");
    expect(encodeRule({ kind: "weekdays", days: [0, 6, 9] })).toBe("w:0,6");
    expect(encodeRule({ kind: "weekdays", days: [] })).toBeNull();
  });

  it.each([
    ["1d", "2026-11-21", "2026-11-22"],
    ["1d", "2026-11-18", "2026-11-22"],
    ["3d", "2026-11-20", "2026-11-23"],
    ["1w", "2026-11-16", "2026-11-23"],
    ["2w", "2026-11-23", "2026-12-07"],
    ["wd", "2026-11-20", "2026-11-23"],
    ["w:1,3", "2026-11-23", "2026-11-25"],
    ["w:0", "2026-11-21", "2026-11-22"],
    ["1M", "2026-01-31", "2026-11-30"],
    ["1M", "2026-11-30", "2026-12-30"],
    ["3M", "2026-11-21", "2027-02-21"],
    ["2h", "2026-11-21T09:00", "2026-11-21T11:00"],
    ["1h", "2026-11-21", "2026-11-21T11:00"],
    ["1d", "2026-11-21T08:00", "2026-11-22T08:00"],
    ["1m", "2025-11-21T10:30", "2026-11-21T10:31"],
    ["2d", "2020-01-01", "2026-11-23"],
    ["1M", "2026-10-21T09:00", "2026-12-21T09:00"],
    ["1M", "2026-11-21T11:00", "2026-12-21T11:00"],
  ])("repeats %s from %s to %s", (rule, due, next) => {
    expect(nextOccurrence(rule, due, NOW)).toBe(next);
  });

  it("starts from now when there's no due date", () => {
    expect(nextOccurrence("15m", null, NOW)).toBe("2026-11-21T10:45");
    expect(nextOccurrence("1d", null, NOW)).toBe("2026-11-22");
    expect(nextOccurrence("bad", null, NOW)).toBeNull();
    expect(firstOccurrence("bad", NOW)).toBeNull();
  });
});

describe("parseTodo", () => {
  it.each([
    ["Call Sam tomorrow 3pm", "Call Sam", "2026-11-22T15:00", null],
    ["Pay rent today", "Pay rent", "2026-11-21", null],
    ["Movie tonight", "Movie", "2026-11-21T20:00", null],
    ["Dentist monday", "Dentist", "2026-11-23", null],
    ["Dentist next monday", "Dentist", "2026-11-23", null],
    ["Gym on sat", "Gym", "2026-11-21", null],
    ["Gym next sat", "Gym", "2026-11-28", null],
    ["Report dec 24", "Report", "2026-12-24", null],
    ["Report 3rd jan", "Report", "2027-01-03", null],
    ["Party 2026-12-31 at 9pm", "Party", "2026-12-31T21:00", null],
    ["Standup at 9:15", "Standup", "2026-11-22T09:15", null],
    ["Lunch at noon", "Lunch", "2026-11-21T12:00", null],
    ["Meet at 5", "Meet", "2026-11-21T17:00", null],
    ["Stretch in 30 minutes", "Stretch", "2026-11-21T11:00", null],
    ["Check the oven in 2 hours", "Check the oven", "2026-11-21T12:30", null],
    ["Stretch in 1 minute", "Stretch", "2026-11-21T10:31", null],
    ["Trip in 2 weeks", "Trip", "2026-12-05", null],
    ["Pay in 1 month", "Pay", "2026-12-21", null],
    ["Gym at 8", "Gym", "2026-11-22T08:00", null],
    ["Gym at 12", "Gym", "2026-11-21T12:00", null],
    ["Lunch at noon", "Lunch", "2026-11-21T12:00", null],
    ["Sleep at midnight", "Sleep", "2026-11-22T00:00", null],
    ["Read tonight", "Read", "2026-11-21T20:00", null],
    ["Report 2026-02-30", "Report 2026-02-30", null, null],
    ["Party feb 30", "Party feb 30", null, null],
    ["Party 31 apr", "Party 31 apr", null, null],
    ["Renew passport in 2 weeks", "Renew passport", "2026-12-05", null],
    ["Renew lease in 1 month", "Renew lease", "2026-12-21", null],
    ["Check on visa next week", "Check on visa", "2026-11-28", null],
    ["Water plants every 3 days", "Water plants", "2026-11-21", "3d"],
    ["Take pills daily", "Take pills", "2026-11-21", "1d"],
    ["Standup every weekday at 9am", "Standup", "2026-11-23T09:00", "wd"],
    ["Stand up every 45 min", "Stand up", "2026-11-21T11:15", "45m"],
    ["Call mom every sunday", "Call mom", "2026-11-22", "w:0"],
    ["Gym every mon, wed and fri", "Gym", "2026-11-23", "w:1,3,5"],
    ["Pay bills every month", "Pay bills", "2026-11-21", "1M"],
    ["Plan trip tomorrow, at 10am", "Plan trip", "2026-11-22T10:00", null],
    ["Back up laptop weekly #home", "Back up laptop #home", "2026-11-21", "1w"],
    ["Bake for midnight", "Bake for", "2026-11-22T00:00", null],
  ])("reads %j", (input, text, due, repeat) => {
    expect(parseTodo(input, NOW)).toEqual({ text, due, repeat });
  });

  it.each([
    "Sit in the sun",
    "Buy 2 apples",
    "every day",
    "Plan the feb 30 party",
    "C# notes at 10%",
  ])("leaves %j alone", (input) => {
    expect(parseTodo(input, NOW).due).toBeNull();
  });

  it("keeps the text when parsing would empty it", () => {
    expect(parseTodo("  tomorrow  ", NOW)).toEqual({ text: "tomorrow", due: null, repeat: null });
  });
});

describe("format", () => {
  beforeEach(() => {
    vi.spyOn(fakeBrowser.i18n, "getMessage").mockImplementation((name: string, substitutions?: string | Array<string | number>) => (substitutions === undefined ? name : `${name}(${[substitutions].flat().join(",")})`));
  });

  it("labels due dates relative to today", () => {
    expect(formatDue("2026-11-21", NOW, "en-US")).toEqual({ label: "due_today", overdue: false, soon: true });
    expect(formatDue("2026-11-22T15:00", NOW, "en-US")).toEqual({ label: "due_tomorrow 3:00 PM", overdue: false, soon: false });
    expect(formatDue("2026-11-20", NOW, "en-US")).toEqual({ label: "due_yesterday", overdue: true, soon: true });
    expect(formatDue("2026-11-24", NOW, "en-US").label).toBe("Tue");
    expect(formatDue("2026-12-24", NOW, "en-US").label).toBe("Dec 24");
    expect(formatDue("2027-01-03", NOW, "en-US").label).toBe("Jan 3, 2027");
    expect(formatDue("2026-11-10", NOW, "en-US")).toMatchObject({ label: "Nov 10", overdue: true });
  });

  it("names weekdays, Sunday first", () => {
    expect(weekdayNames("en-US")).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    expect(weekdayNames("en-US", "long")[1]).toBe("Monday");
  });

  it("describes repeat rules", () => {
    expect(formatRule("wd", "en-US")).toBe("repeat_weekdays");
    expect(formatRule("w:1,3", "en-US")).toBe("repeat_on(Mon, Wed)");
    expect(formatRule({ kind: "interval", every: 2, unit: "h" }, "en-US")).toContain("repeat_hours");
    expect(formatRule("bad")).toBe("");
  });
});

describe("completeTodo", () => {
  it("moves a repeating to-do to its next date and the bottom, logging the check-off, and checks off anything else", async () => {
    const update = vi.fn(async () => {});
    const base = { id: "a", due: "2026-11-21", repeat: null, position: "a1", history: [] } as never;
    const minute = Math.floor(NOW.getTime() / 60_000) * 60_000;

    expect(await completeTodo({ update }, { ...(base as object), repeat: "1d", history: [5 * 60_000] } as never, NOW, "a5")).toBe("2026-11-22");
    expect(update).toHaveBeenLastCalledWith("a", { due: "2026-11-22", done: false, today: null, history: [5 * 60_000, minute], position: "a6" });

    // Already the last one, or the only one, it keeps its place.
    await completeTodo({ update }, { ...(base as object), repeat: "1d" } as never, NOW, "a1");
    expect(update).toHaveBeenLastCalledWith("a", expect.objectContaining({ position: "a1", history: [minute] }));
    await completeTodo({ update }, { ...(base as object), repeat: "1d" } as never, NOW, null);
    expect(update).toHaveBeenLastCalledWith("a", expect.objectContaining({ position: "a1" }));

    expect(await completeTodo({ update }, base, NOW, "a5")).toBeNull();
    expect(update).toHaveBeenLastCalledWith("a", { done: true });

    // A rule this version can't read (from a newer one) just checks it off.
    expect(await completeTodo({ update }, { ...(base as object), repeat: "someday" } as never, NOW, "a5")).toBeNull();
    expect(update).toHaveBeenLastCalledWith("a", { done: true });
  });
});
