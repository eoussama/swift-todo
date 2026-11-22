import type { TPrefs } from "~/lib/prefs/prefs";
import type { TBackgroundApi, TNotificationOptions } from "~/lib/time/runtime";
import type { TTodo } from "~/lib/todos/model";

import { describe, expect, it, vi } from "vitest";

import { DEFAULT_PREFS } from "~/lib/prefs/prefs";
import { isOverdue, nextTimeOfDay, parseDue } from "~/lib/time/date";
import { formatDue } from "~/lib/time/format";
import { parseTodo } from "~/lib/time/parse";
import { encodeRule, firstOccurrence, nextOccurrence, parseRule } from "~/lib/time/recur";
import { badgeFor, EMPTY_REMINDER_STATE, nextBadgeChange, planReminders, shouldNudge } from "~/lib/time/reminders";
import { ALARMS, createScheduler } from "~/lib/time/runtime";
import { parseTimer, saveTimer } from "~/lib/time/timer";
import { decodeTodo, encodeTodo } from "~/lib/todos/model";

import { memoryArea } from "./helpers";



// Saturday, November 21, 2026, 10:30 local time.
const NOW = new Date(2026, 10, 21, 10, 30);
const MINUTE = 60_000;

function at(day: number, hours = 0, minutes = 0): number {
  return new Date(2026, 10, day, hours, minutes).getTime();
}

function todo(id: string, fields: { text?: string; due?: string | null; done?: boolean } = {}): TTodo {
  return decodeTodo(id, encodeTodo({ text: fields.text ?? id, done: fields.done ?? false, position: "a0", createdAt: 1, updatedAt: 1, due: fields.due ?? null, repeat: null }), "sync");
}

describe("reminders for to-dos set up late", () => {
  it("don't fire for a time that had passed when the to-do was last changed", () => {
    const late = { ...todo("a", { due: "2026-11-21T10:00" }), updatedAt: new Date(2026, 10, 21, 10, 0, 1).getTime() };
    const onTime = { ...todo("b", { due: "2026-11-21T10:00" }), updatedAt: new Date(2026, 10, 21, 10, 0).getTime() };
    const plan = planReminders([late, onTime], { lead: 0 }, { notified: {}, snoozed: {}, lastNudge: 0 }, NOW);

    expect(plan.fire.map(item => item.id)).toEqual(["b"]);
    expect(plan.state.notified).toEqual({ a: "2026-11-21T10:00", b: "2026-11-21T10:00" });
  });
});

describe("parseTodo, in more detail", () => {
  it.each([
    // Short weekday names after a prefix word, in any case.
    ["Gym on sun", "Gym", "2026-11-22", null],
    ["Gym on tues", "Gym", "2026-11-24", null],
    ["Gym on thur", "Gym", "2026-11-26", null],
    ["Gym on thurs", "Gym", "2026-11-26", null],
    ["Gym by fri", "Gym", "2026-11-27", null],
    ["Gym due fri", "Gym", "2026-11-27", null],
    ["Gym this fri", "Gym", "2026-11-27", null],
    ["Gym ON FRI", "Gym", "2026-11-27", null],
    ["Gym NEXT sat", "Gym", "2026-11-28", null],
    // Full weekday names alone: today counts.
    ["Dentist saturday", "Dentist", "2026-11-21", null],
    ["Dentist FRIDAY", "Dentist", "2026-11-27", null],
    // Every month, short or long, rolling over to next year once past.
    ["Trip jan 5", "Trip", "2027-01-05", null],
    ["Trip january 5", "Trip", "2027-01-05", null],
    ["Trip feb 5", "Trip", "2027-02-05", null],
    ["Trip mar 5", "Trip", "2027-03-05", null],
    ["Trip apr 5", "Trip", "2027-04-05", null],
    ["Trip may 5", "Trip", "2027-05-05", null],
    ["Trip jun 5", "Trip", "2027-06-05", null],
    ["Trip jul 5", "Trip", "2027-07-05", null],
    ["Trip aug 5", "Trip", "2027-08-05", null],
    ["Trip sep 5", "Trip", "2027-09-05", null],
    ["Trip sept 5", "Trip", "2027-09-05", null],
    ["Trip oct 5", "Trip", "2027-10-05", null],
    ["Trip nov 5", "Trip", "2027-11-05", null],
    ["Trip DEC 5", "Trip", "2026-12-05", null],
    ["Trip 5 DEC", "Trip", "2026-12-05", null],
    ["Trip nov 21", "Trip", "2026-11-21", null],
    ["Trip nov 20", "Trip", "2027-11-20", null],
    ["Trip dec 24 2027", "Trip", "2027-12-24", null],
    ["Trip jan 5 2026", "Trip", "2026-01-05", null],
    ["Trip by dec 24 please", "Trip please", "2026-12-24", null],
    ["Trip on 24 dec please", "Trip please", "2026-12-24", null],
    // "on" inside a word is not a prefix.
    ["Meet Jon dec 5", "Meet Jon", "2026-12-05", null],
    ["Meet Jon 5 dec", "Meet Jon", "2026-12-05", null],
    ["Plan won dec 5", "Plan won", "2026-12-05", null],
    // Dates that don't exist stay in the text.
    ["Plan 2026-13-01", "Plan 2026-13-01", null, null],
    ["Plan 2026-12-32", "Plan 2026-12-32", null, null],
    ["Plan 2026-12-01", "Plan", "2026-12-01", null],
    // Times.
    ["Call 3 pm", "Call", "2026-11-21T15:00", null],
    ["Call 3:15pm", "Call", "2026-11-21T15:15", null],
    ["Call at 3pm about taxes", "Call about taxes", "2026-11-21T15:00", null],
    ["Call at  3pm about taxes", "Call about taxes", "2026-11-21T15:00", null],
    ["Call 20:00", "Call", "2026-11-21T20:00", null],
    ["Call 21:00", "Call", "2026-11-21T21:00", null],
    ["Call 10:15 standup", "Call standup", "2026-11-22T10:15", null],
    ["Call at 20:00 about taxes", "Call about taxes", "2026-11-21T20:00", null],
    ["Call at  20:00 about taxes", "Call about taxes", "2026-11-21T20:00", null],
    ["Call at 10:30", "Call", "2026-11-22T10:30", null],
    ["Call at  5", "Call", "2026-11-21T17:00", null],
    ["Call at 5, then lunch", "Call, then lunch", "2026-11-21T17:00", null],
    ["Call at 5 tomorrow", "Call", "2026-11-22T17:00", null],
    ["Call at 5 #work", "Call #work", "2026-11-21T17:00", null],
    ["Call at 5.", "Call.", "2026-11-21T17:00", null],
    ["Look at 3 options", "Look at 3 options", null, null],
    // Loose date words that are just words here.
    ["Cancel monthly subscription", "Cancel monthly subscription", null, null],
    ["Write weekly report", "Write weekly report", null, null],
    ["Read John 3:16", "Read John 3:16", null, null],
    ["Put in 10 hours of practice", "Put in 10 hours of practice", null, null],
    ["Work on sat prep", "Work on sat prep", null, null],
    // And where they still read as dates.
    ["Pay rent monthly #home", "Pay rent #home", "2026-11-21", "1M"],
    ["Stretch Daily", "Stretch", "2026-11-21", "1d"],
    ["Meet at 10:45 with Sam", "Meet with Sam", "2026-11-21T10:45", null],
    ["Call at 5 Tomorrow", "Call", "2026-11-22T17:00", null],
    ["Back up weekly, on fridays", "Back up, on fridays", "2026-11-21", "1w"],
    ["Gym on sat", "Gym", "2026-11-21", null],
    ["Gym on sat at 9am", "Gym", "2026-11-21T09:00", null],
    ["Meet at 9:30", "Meet", "2026-11-22T09:30", null],
    ["Meet 09:30", "Meet", "2026-11-22T09:30", null],
    ["Rest in 2 days.", "Rest.", "2026-11-23", null],
    ["Call in 2 hours #work", "Call #work", "2026-11-21T12:30", null],
    ["Call mom tomorrow 9:30", "Call mom", "2026-11-22T09:30", null],
    ["Call mom Tomorrow 9:30", "Call mom", "2026-11-22T09:30", null],
    ["Due fri:: submit", "submit", "2026-11-27", null],
    ["Read John 3:16 tomorrow", "Read John 3:16", "2026-11-22", null],
    ["Next mon dentist", "dentist", "2026-11-23", null],
    ["This sat party", "party", "2026-11-21", null],
    ["Due fri: submit the form", "submit the form", "2026-11-27", null],
    ["Call back in 2 hours - urgent", "Call back - urgent", "2026-11-21T12:30", null],
    ["A long-term goal", "A long-term goal", null, null],
    ["Look at 3.5 options", "Look at 3.5 options", null, null],
    ["Call mom tonight at 9", "Call mom", "2026-11-21T21:00", null],
    ["Call mom tonight at 9:30", "Call mom", "2026-11-21T21:30", null],
    ["Call mom tonight at 9am", "Call mom", "2026-11-21T09:00", null],
    ["Call mom tonight at 21:00", "Call mom", "2026-11-21T21:00", null],
    // Midnight, or a plain 12, ends tonight; noon and 12pm stay noon.
    ["Party tonight at midnight", "Party", "2026-11-22T00:00", null],
    ["Party tonight at 12", "Party", "2026-11-22T00:00", null],
    ["Party tonight at 12am", "Party", "2026-11-22T00:00", null],
    ["Party tonight at 0:30", "Party", "2026-11-22T00:30", null],
    // Tonight runs into the small hours: before 6 is the next day.
    ["Call Sam tonight at 1am", "Call Sam", "2026-11-22T01:00", null],
    ["Call Sam tonight at 2", "Call Sam", "2026-11-22T02:00", null],
    ["Call Sam tonight at 3:30", "Call Sam", "2026-11-22T03:30", null],
    ["Call Sam tonight at 4", "Call Sam", "2026-11-21T16:00", null],
    ["Dinner tonight at 5:30", "Dinner", "2026-11-21T17:30", null],
    ["Call Sam tonight at 5am", "Call Sam", "2026-11-22T05:00", null],
    ["Call Sam tonight at 6", "Call Sam", "2026-11-21T18:00", null],
    ["Call Sam tonight at 11pm", "Call Sam", "2026-11-21T23:00", null],
    ["Call Sam tonight at 6am", "Call Sam", "2026-11-21T06:00", null],
    ["Lunch tonight at noon", "Lunch", "2026-11-21T12:00", null],
    ["Lunch tonight at 12pm", "Lunch", "2026-11-21T12:00", null],
    ["Meet Sam at 9 thursday", "Meet Sam", "2026-11-26T09:00", null],
    ["Call at 0", "Call", "2026-11-22T00:00", null],
    ["Call at 1", "Call", "2026-11-21T13:00", null],
    ["Call at 7", "Call", "2026-11-21T19:00", null],
    ["Call at 21", "Call", "2026-11-21T21:00", null],
    ["Meet tomorrow at 5", "Meet", "2026-11-22T17:00", null],
    ["Call at 5 %", "Call at 5 %", null, null],
    ["Call at 5.5", "Call at 5.5", null, null],
    ["Lunch at noon with Sam", "Lunch with Sam", "2026-11-21T12:00", null],
    ["Lunch at  noon with Sam", "Lunch with Sam", "2026-11-21T12:00", null],
    // Relative dates.
    ["Rest IN 2 DAYS", "Rest", "2026-11-23", null],
    ["Rest in 10 days", "Rest", "2026-12-01", null],
    ["Plan tomorrow", "Plan", "2026-11-22", null],
    ["Plan tmr", "Plan", "2026-11-22", null],
    ["Plan next  week", "Plan", "2026-11-28", null],
    // Repeats.
    ["Run EVERY 2 DAYS", "Run", "2026-11-21", "2d"],
    ["Run EVERY MON", "Run", "2026-11-23", "w:1"],
    ["Run every  weekday", "Run", "2026-11-23", "wd"],
    ["Run every  day", "Run", "2026-11-21", "1d"],
    ["Run every min", "Run", "2026-11-21T10:31", "1m"],
    ["Run every sat at 9am", "Run", "2026-11-28T09:00", "w:6"],
    ["Pay rent every month dec 1", "Pay rent", "2026-12-01", "1M"],
    // A word already used by the repeat isn't read again as the date.
    ["Gym every monday friday", "Gym", "2026-11-27", "w:1"],
    ["Gym friday every monday", "Gym", "2026-11-27", "w:1"],
    ["Water tomorrow plants every 3 days", "Water plants", "2026-11-22", "3d"],
    // What's left is tidied up.
    ["Tomorrow call Sam", "call Sam", "2026-11-22", null],
    ["Feed cat tomorrow", "Feed cat", "2026-11-22", null],
    ["Pay by tomorrow", "Pay", "2026-11-22", null],
    ["Tomorrow pay by", "pay", "2026-11-22", null],
    ["Call Sam tomorrow, please", "Call Sam, please", "2026-11-22", null],
    ["Call Sam tomorrow; then Bob at 3pm!", "Call Sam; then Bob!", "2026-11-22T15:00", null],
  ])("reads %j", (input, text, due, repeat) => {
    expect(parseTodo(input, NOW)).toEqual({ text, due, repeat });
  });

  it.each([
    "At tomorrow",
    "Buy  milk",
    "Look at",
  ])("keeps %j exactly as typed when nothing is left or found", (input) => {
    expect(parseTodo(input, NOW)).toEqual({ text: input, due: null, repeat: null });
  });
});

describe("repeat rules, in more detail", () => {
  it("reads only whole stored rules", () => {
    expect(parseRule("xw:1")).toBeNull();
    expect(parseRule("w:1x")).toBeNull();
    expect(parseRule("x3d")).toBeNull();
    expect(parseRule("3dx")).toBeNull();
  });

  it("drops weekdays out of range when writing a rule", () => {
    expect(encodeRule({ kind: "weekdays", days: [-1, 2] })).toBe("w:2");
  });

  it.each([
    ["3M", "2026-01-15", "2027-01-15"],
    ["1M", "2025-06-15", "2026-12-15"],
    ["1M", "2026-12-05", "2027-01-05"],
    ["1M", "2026-10-21T10:30", "2026-12-21T10:30"],
    ["5M", "2020-03-10", "2027-04-10"],
    ["2h", "2026-11-21T09:15", "2026-11-21T11:15"],
    ["2h", "2026-11-21", "2026-11-21T11:00"],
    ["2h", "2026-11-21T12:00", "2026-11-21T14:00"],
    ["30m", "2026-11-21T10:00", "2026-11-21T11:00"],
    ["1d", "2026-11-20T10:30", "2026-11-22T10:30"],
    ["3d", "2026-11-01", "2026-11-22"],
    ["1w", "2026-10-01", "2026-11-26"],
    ["w:6", "2026-11-14T10:30", "2026-11-28T10:30"],
    ["w:2", "2026-11-21T09:00", "2026-11-24T09:00"],
    ["w:1", null, "2026-11-23"],
  ])("repeats %s from %s to %s", (rule, due, next) => {
    expect(nextOccurrence(rule, due, NOW)).toBe(next);
  });

  it.each([
    ["w:1", "2026-11-23"],
    ["w:6", "2026-11-21"],
    ["1h", "2026-11-21T11:30"],
    ["30m", "2026-11-21T11:00"],
    ["2d", "2026-11-21"],
  ])("starts %s on %s", (rule, due) => {
    expect(firstOccurrence(rule, NOW)).toBe(due);
  });
});

describe("dates and labels at the edges", () => {
  it("isn't overdue at the very minute it's due", () => {
    expect(isOverdue("2026-11-21T10:30", NOW)).toBe(false);
  });

  it("finds tomorrow's time when it's that time now", () => {
    expect(nextTimeOfDay("10:30", NOW)).toBe(at(22, 10, 30));
  });

  it("reads a due value with its time", () => {
    expect(parseDue("2026-11-21T07:05")).toEqual({ date: new Date(at(21, 7, 5)), hasTime: true });
  });

  it("names the weekday for the coming week only", () => {
    expect(formatDue("2026-11-23", NOW, "en-US").label).toBe("Mon");
    expect(formatDue("2026-11-27", NOW, "en-US").label).toBe("Fri");
    expect(formatDue("2026-11-28", NOW, "en-US").label).toBe("Nov 28");
  });

  it("doesn't count tomorrow as soon", () => {
    expect(formatDue("2026-11-22", NOW, "en-US").soon).toBe(false);
  });
});

describe("focus timer storage", () => {
  it("rejects a timer whose start or end isn't a number", () => {
    expect(parseTimer({ startedAt: "1", endsAt: 2 })).toBeNull();
    expect(parseTimer({ startedAt: 1, endsAt: "2" })).toBeNull();
  });

  it("stores the timer under its own key", async () => {
    const area = memoryArea("session");

    await saveTimer(area, { startedAt: 1, endsAt: 2, todo: null });
    expect([...area.data.keys()]).toEqual(["focus:timer"]);
  });
});

describe("reminder planning at the edges", () => {
  it("reminds right away about a to-do set up inside its lead time, before it's due", () => {
    // Due at 10:45, reminded 30 minutes ahead (10:15), but only set up at 10:29.
    const record = encodeTodo({ text: "Call", done: false, position: "a0", createdAt: at(21, 10, 29), updatedAt: at(21, 10, 29), due: "2026-11-21T10:45", repeat: null });
    const plan = planReminders([decodeTodo("late-setup", record, "sync")], { lead: 30 }, EMPTY_REMINDER_STATE, NOW);

    expect(plan.fire.map(item => item.id)).toEqual(["late-setup"]);

    // Set up after it was already due: no reminder, the overdue nudges take it.
    const overdue = encodeTodo({ text: "Old", done: false, position: "a0", createdAt: at(21, 10, 29), updatedAt: at(21, 10, 29), due: "2026-11-21T10:00", repeat: null });

    expect(planReminders([decodeTodo("old", overdue, "sync")], { lead: 30 }, EMPTY_REMINDER_STATE, NOW).fire).toEqual([]);
  });

  it("fires a reminder at its very minute, and one exactly a day late", () => {
    const plan = planReminders([todo("now", { due: "2026-11-21T10:30" }), todo("late", { due: "2026-11-20T10:30" })], { lead: 0 }, EMPTY_REMINDER_STATE, NOW);

    expect(plan.fire.map(item => item.id)).toEqual(["now", "late"]);
    expect(plan.next).toBeNull();
  });

  it("wakes up for the earliest reminder, in any order, without snoozing it", () => {
    for (const todos of [[todo("a", { due: "2026-11-21T18:00" }), todo("b", { due: "2026-11-21T12:00" })], [todo("b", { due: "2026-11-21T12:00" }), todo("a", { due: "2026-11-21T18:00" })]]) {
      const plan = planReminders(todos, { lead: 0 }, EMPTY_REMINDER_STATE, NOW);

      expect(plan.next).toBe(at(21, 12));
      expect(plan.state.snoozed).toEqual({});
    }
  });

  it("shows up to 99 on the badge", () => {
    expect(badgeFor(Array.from({ length: 99 }, (_, i) => todo(`t${i}`)), "open", NOW).text).toBe("99");
  });

  it("changes the badge at the next timed due, never a past or later one", () => {
    const midnight = at(22);

    expect(nextBadgeChange([todo("past", { due: "2026-11-21T09:00" })], NOW)).toBe(midnight);
    expect(nextBadgeChange([todo("now", { due: "2026-11-21T10:30" })], NOW)).toBe(midnight);
    expect(nextBadgeChange([todo("tomorrow", { due: "2026-11-22T15:00" })], NOW)).toBe(midnight);
    expect(nextBadgeChange([todo("a", { due: "2026-11-21T12:00" }), todo("b", { due: "2026-11-21T18:00" })], NOW)).toBe(at(21, 12));
    expect(nextBadgeChange([todo("b", { due: "2026-11-21T18:00" }), todo("a", { due: "2026-11-21T12:00" })], NOW)).toBe(at(21, 12));
  });

  it("nudges from 9:00 until 21:00, every three hours at most", () => {
    const summary = { open: 1, dueToday: 0, overdue: 1 };

    expect(shouldNudge(summary, EMPTY_REMINDER_STATE, new Date(at(21, 9)))).toBe(true);
    expect(shouldNudge(summary, EMPTY_REMINDER_STATE, new Date(at(21, 20, 59)))).toBe(true);
    expect(shouldNudge(summary, EMPTY_REMINDER_STATE, new Date(at(21, 21)))).toBe(false);
    expect(shouldNudge(summary, { ...EMPTY_REMINDER_STATE, lastNudge: NOW.getTime() - 180 * MINUTE }, NOW)).toBe(true);
    expect(shouldNudge(summary, { ...EMPTY_REMINDER_STATE, lastNudge: NOW.getTime() - 180 * MINUTE + 1 }, NOW)).toBe(false);
  });
});

describe("background scheduler, in more detail", () => {
  function harness(todos: Array<TTodo> = [], prefs: Partial<TPrefs> = {}) {
    const state = { todos, prefs: { ...DEFAULT_PREFS, ...prefs }, granted: true, clock: NOW };
    const alarms = new Map<string, { when?: number; periodInMinutes?: number }>();
    const created: Array<string> = [];
    const notified: Array<{ id: string } & TNotificationOptions> = [];
    const dismissed: Array<string> = [];
    const badges: Array<{ text: string; color: string }> = [];
    const update = vi.fn(async () => {});
    const local = memoryArea();
    const session = memoryArea("session");

    const api: TBackgroundApi = {
      repository: { load: async () => ({ todos: state.todos, prefs: state.prefs }) as never, update },
      alarms: {
        create: (name, info) => {
          created.push(name);
          alarms.set(name, "when" in info ? { when: info.when } : { periodInMinutes: info.periodInMinutes });
        },
        clear: name => alarms.delete(name),
        get: async (name) => {
          const alarm = alarms.get(name);

          return alarm === undefined ? undefined : { scheduledTime: alarm.when ?? 0 };
        },
      },
      notify: async (id, options) => {
        notified.push({ id, ...options });

        return state.granted;
      },
      clearNotification: async (id) => {
        dismissed.push(id);
      },
      canNotify: async () => state.granted,
      setBadge: async (text, color) => {
        badges.push({ text, color });
      },
      local,
      session,
      supportsButtons: true,
      t: (key, substitutions) => (substitutions === undefined ? key : `${key}(${[substitutions].flat().join(",")})`),
      now: () => state.clock,
    };

    return { api, scheduler: createScheduler(api), state, alarms, created, notified, dismissed, badges, update, local, session };
  }

  it("keeps the alarm and storage names the browser already knows", async () => {
    expect(ALARMS).toEqual({
      reminders: "swift-todo:reminders",
      digest: "swift-todo:digest",
      nudge: "swift-todo:nudge",
      focusEnd: "swift-todo:focus-end",
      focusTick: "swift-todo:focus-tick",
    });

    const { scheduler, local } = harness([todo("a", { due: "2026-11-21T10:00" })], { reminders: true });

    await scheduler.refresh();
    expect([...local.data.keys()]).toEqual(["reminders:state"]);
  });

  it("moves the digest alarm when it's set for another time, and leaves it when it's right", async () => {
    const { scheduler, alarms, created } = harness([], { digest: "09:00" });

    alarms.set(ALARMS.digest, { when: 1 });
    await scheduler.refresh();
    expect(alarms.get(ALARMS.digest)?.when).toBe(at(22, 9));

    await scheduler.refresh();
    expect(created.filter(name => name === ALARMS.digest)).toHaveLength(1);
  });

  it("says when the to-do is due in its reminder", async () => {
    const { scheduler, notified } = harness([todo("a", { text: "Call Sam", due: "2026-11-21T10:00" })], { reminders: true });

    await scheduler.refresh();
    expect(notified[0]?.message).toBe(`notify.overdue(${formatDue("2026-11-21T10:00", NOW).label})`);
  });

  it("wakes up when the badge changes, even with reminders off", async () => {
    const { scheduler, alarms } = harness([todo("a", { due: "2026-11-21T18:00" })]);

    await scheduler.refresh();
    expect(alarms.get(ALARMS.reminders)?.when).toBe(at(21, 18));
  });

  it("wakes up at midnight when no reminder is coming", async () => {
    const { scheduler, alarms } = harness([], { reminders: true });

    await scheduler.refresh();
    expect(alarms.get(ALARMS.reminders)?.when).toBe(at(22));
  });

  it("wakes up for the badge before a later reminder", async () => {
    const { scheduler, alarms } = harness([todo("a", { due: "2026-11-22" })], { reminders: true });

    await scheduler.refresh();
    expect(alarms.get(ALARMS.reminders)?.when).toBe(at(22));
  });

  it("sends no digest when it's turned off", async () => {
    const { scheduler, notified } = harness([todo("a")]);

    await scheduler.onAlarm(ALARMS.digest);
    expect(notified).toEqual([]);
  });

  it("nudges with the number of overdue to-dos", async () => {
    const { scheduler, notified } = harness([todo("a", { due: "2026-11-20" })], { nudges: true });

    await scheduler.onAlarm(ALARMS.nudge);
    expect(notified).toEqual([{ id: "nudge", title: "notify.nudgeTitle", message: "notify.nudge(1)" }]);
  });

  it("refreshes on the reminders and focus tick alarms, and ignores others", async () => {
    const { scheduler, badges, created, alarms } = harness();

    await scheduler.onAlarm("unrelated");
    expect(badges).toEqual([]);
    expect(created).toEqual([]);
    expect(alarms.size).toBe(0);

    await scheduler.onAlarm(ALARMS.reminders);
    expect(badges).toHaveLength(1);

    await scheduler.onAlarm(ALARMS.focusTick);
    expect(badges).toHaveLength(2);
  });

  it("takes turns with the reminder state, so a nudge and a snooze at once both stay", async () => {
    const { scheduler, local } = harness([todo("a", { due: "2026-11-20" }), todo("b", { due: "2026-11-21T10:00" })], { nudges: true });

    await local.set({ "reminders:state": { notified: { b: "2026-11-21T10:00" }, snoozed: {}, lastNudge: 0 } });

    // Saving takes a moment, so one would read while the other saves if they didn't wait for each other.
    const set = local.set.bind(local);

    local.set = async (items) => {
      await new Promise(resolve => setTimeout(resolve, 5));
      await set(items);
    };

    await Promise.all([scheduler.onAlarm(ALARMS.nudge), scheduler.onButton("due:b", 1)]);

    const saved = local.data.get("reminders:state") as { lastNudge: number; snoozed: Record<string, number> };

    expect(saved.lastNudge).toBe(NOW.getTime());
    expect(Object.keys(saved.snoozed)).toEqual(["b"]);
  });

  it("keeps taking turns after one fails", async () => {
    const { scheduler, api } = harness([todo("a")]);
    const load = api.repository.load;

    api.repository.load = async () => Promise.reject(new Error("storage is gone"));
    await expect(scheduler.refresh()).rejects.toThrow("storage is gone");
    api.repository.load = load;
    await expect(scheduler.refresh()).resolves.toBeUndefined();
  });

  it("only handles buttons of due reminders, on the right to-do", async () => {
    const { scheduler, dismissed, update, local } = harness([todo("a"), todo("b", { due: "2026-11-21T10:00" })]);

    await local.set({ "reminders:state": { notified: { b: "2026-11-21T10:00" }, snoozed: {}, lastNudge: 0 } });
    await scheduler.onButton("digest", 0);
    expect(dismissed).toEqual([]);
    expect(update).not.toHaveBeenCalled();

    await scheduler.onButton("due:b", 0);
    expect(dismissed).toEqual(["due:b"]);
    expect(update).toHaveBeenCalledWith("b", { done: true });

    await scheduler.onButton("due:a", 1);
    expect((local.data.get("reminders:state") as { snoozed: Record<string, number> }).snoozed).toEqual({ a: NOW.getTime() + 10 * MINUTE });
  });

  it("ignores Done on a reminder for a date the to-do has moved on from", async () => {
    const { scheduler, dismissed, update, local } = harness([todo("a", { due: "2026-11-22T10:00" })]);

    await local.set({ "reminders:state": { notified: { a: "2026-11-21T10:00" }, snoozed: {}, lastNudge: 0 } });
    await scheduler.onButton("due:a", 0);
    expect(dismissed).toEqual(["due:a"]);
    expect(update).not.toHaveBeenCalled();
  });

  it("sums up three or more reminders at once in one notification", async () => {
    const two = harness([todo("a", { due: "2026-11-21T10:00" }), todo("b", { due: "2026-11-21T10:10" })], { reminders: true });

    await two.scheduler.refresh();
    expect(two.notified.map(item => item.id)).toEqual(["due:a", "due:b"]);

    const three = harness([todo("a", { due: "2026-11-21T10:00" }), todo("b", { due: "2026-11-21T10:10" }), todo("c", { due: "2026-11-21T10:20" })], { reminders: true });

    await three.scheduler.refresh();
    expect(three.notified).toEqual([{ id: "due:many", title: "notify.manyTitle", message: "notify.many(3)" }]);
  });

  it("finishes a timer with a second or less to go, and keeps one with more", async () => {
    const running = harness();

    await saveTimer(running.session, { startedAt: 0, endsAt: NOW.getTime() + 1_001, todo: null });
    await running.scheduler.refresh();
    expect(running.session.data.size).toBe(1);
    expect(running.badges).toEqual([{ text: "1m", color: "#1f8a68" }]);

    await running.scheduler.onAlarm(ALARMS.focusEnd);
    expect(running.session.data.size).toBe(1);
    expect(running.notified).toEqual([]);

    for (const finish of ["refresh", "end alarm"]) {
      const done = harness();

      await saveTimer(done.session, { startedAt: 0, endsAt: NOW.getTime() + 1_000, todo: null });
      await (finish === "refresh" ? done.scheduler.refresh() : done.scheduler.onAlarm(ALARMS.focusEnd));
      expect(done.session.data.size).toBe(0);
      expect(done.notified).toEqual([{ id: "focus", title: "notify.focusTitle", message: "notify.focus" }]);
    }
  });

  it("names the to-do the timer was for, and stays quiet without the permission", async () => {
    const named = harness([todo("a", { text: "First" }), todo("b", { text: "Second" })]);

    await saveTimer(named.session, { startedAt: 0, endsAt: NOW.getTime(), todo: "b" });
    await named.scheduler.refresh();
    expect(named.notified.map(item => item.message)).toEqual(["notify.focusTodo(Second)"]);

    const unnamed = harness([todo("a", { text: "First" })]);

    await saveTimer(unnamed.session, { startedAt: 0, endsAt: NOW.getTime(), todo: null });
    await unnamed.scheduler.refresh();
    expect(unnamed.notified.map(item => item.message)).toEqual(["notify.focus"]);

    const quiet = harness();

    quiet.state.granted = false;
    await saveTimer(quiet.session, { startedAt: 0, endsAt: NOW.getTime(), todo: null });
    await quiet.scheduler.refresh();
    expect(quiet.session.data.size).toBe(0);
    expect(quiet.notified).toEqual([]);
  });
});
