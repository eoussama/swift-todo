import type { TBackgroundApi } from "~/lib/time/runtime";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PREFS } from "~/lib/prefs/prefs";
import { badgeFor, EMPTY_REMINDER_STATE, MAX_LATE_MS, nextBadgeChange, parseReminderState, planReminders, reminderAt, shouldNudge, summarize } from "~/lib/time/reminders";
import { ALARMS, createScheduler, REMINDER_STATE_KEY } from "~/lib/time/runtime";
import { createTimer, readTimer, saveTimer, TIMER_KEY } from "~/lib/time/timer";
import { decodeTodo, encodeTodo } from "~/lib/todos/model";

import { createDevice, memoryArea } from "./helpers";



// Saturday, November 21, 2026, 10:30 local time.
const NOW = new Date(2026, 10, 21, 10, 30);

function todo(id: string, fields: { due?: string | null; done?: boolean; repeat?: string | null } = {}) {
  return decodeTodo(id, encodeTodo({ text: id, done: fields.done ?? false, position: "a0", createdAt: 1, updatedAt: 1, due: fields.due ?? null, repeat: fields.repeat ?? null }), "sync");
}

describe("reminder planning", () => {
  it("reads stored state defensively", () => {
    expect(parseReminderState(undefined)).toEqual(EMPTY_REMINDER_STATE);
    expect(parseReminderState({ notified: { a: "2026-11-21", b: 3 }, snoozed: { a: 5, b: "x" }, lastNudge: "no" })).toEqual({ notified: { a: "2026-11-21" }, snoozed: { a: 5 }, lastNudge: 0 });
  });

  it("reminds at the due time minus the lead, date-only ones at 9:00", () => {
    expect(reminderAt(todo("a", { due: "2026-11-21T15:00" }), 10, EMPTY_REMINDER_STATE)).toBe(new Date(2026, 10, 21, 14, 50).getTime());
    expect(reminderAt(todo("a", { due: "2026-11-22" }), 0, EMPTY_REMINDER_STATE)).toBe(new Date(2026, 10, 22, 9, 0).getTime());
    expect(reminderAt(todo("a", { due: "2026-11-22", done: true }), 0, EMPTY_REMINDER_STATE)).toBeNull();
    expect(reminderAt(todo("a"), 0, EMPTY_REMINDER_STATE)).toBeNull();
    expect(reminderAt(todo("a", { due: "2026-11-22" }), 0, { ...EMPTY_REMINDER_STATE, snoozed: { a: 42 } })).toBe(42);
  });

  it("fires due reminders once, schedules the next, and skips very late ones", () => {
    const todos = [
      todo("due-now", { due: "2026-11-21T10:00" }),
      todo("later", { due: "2026-11-21T18:00" }),
      todo("long-ago", { due: "2026-11-18" }),
      todo("done", { due: "2026-11-21T09:00", done: true }),
    ];
    const plan = planReminders(todos, { lead: 0 }, EMPTY_REMINDER_STATE, NOW);

    expect(plan.fire.map(t => t.id)).toEqual(["due-now"]);
    expect(plan.next).toBe(new Date(2026, 10, 21, 18, 0).getTime());
    expect(plan.state.notified).toEqual({ "due-now": "2026-11-21T10:00", "long-ago": "2026-11-18" });

    // Already shown: not again.
    const again = planReminders(todos, { lead: 0 }, plan.state, NOW);

    expect(again.fire).toEqual([]);
    expect(again.state.notified).toEqual(plan.state.notified);

    // Rescheduled to a new due date: reminds again then.
    const moved = planReminders([todo("due-now", { due: "2026-11-21T10:15" })], { lead: 0 }, plan.state, NOW);

    expect(moved.fire.map(t => t.id)).toEqual(["due-now"]);
    expect(MAX_LATE_MS).toBe(86_400_000);
  });

  it("reminds again after a snooze", () => {
    const state = { notified: {}, snoozed: { a: NOW.getTime() + 60_000 }, lastNudge: 0 };
    const waiting = planReminders([todo("a", { due: "2026-11-21T10:00" })], { lead: 0 }, state, NOW);

    expect(waiting.fire).toEqual([]);
    expect(waiting.next).toBe(NOW.getTime() + 60_000);
    expect(waiting.state.snoozed).toEqual({ a: NOW.getTime() + 60_000 });

    const later = new Date(NOW.getTime() + 61_000);
    const fired = planReminders([todo("a", { due: "2026-11-21T10:00" })], { lead: 0 }, state, later);

    expect(fired.fire.map(t => t.id)).toEqual(["a"]);
    expect(fired.state.snoozed).toEqual({});
  });
});

describe("badge and summaries", () => {
  const todos = [
    todo("overdue", { due: "2026-11-20" }),
    todo("today", { due: "2026-11-21T18:00" }),
    todo("tomorrow", { due: "2026-11-22" }),
    todo("undated"),
    todo("done", { due: "2026-11-19", done: true }),
  ];

  it("counts due and overdue, all open, or nothing", () => {
    expect(badgeFor(todos, "due", NOW)).toEqual({ text: "2", alert: true });
    expect(badgeFor(todos, "open", NOW)).toEqual({ text: "4", alert: true });
    expect(badgeFor(todos, "off", NOW)).toEqual({ text: "", alert: false });
    expect(badgeFor([todo("x", { due: "2026-11-22" })], "due", NOW)).toEqual({ text: "", alert: false });
    expect(badgeFor(Array.from({ length: 120 }, (_, i) => todo(`t${i}`)), "open", NOW).text).toBe("99+");
  });

  it("knows when the badge changes on its own", () => {
    expect(nextBadgeChange(todos, NOW)).toBe(new Date(2026, 10, 21, 18, 0).getTime());
    expect(nextBadgeChange([], NOW)).toBe(new Date(2026, 10, 22).getTime());
  });

  it("summarizes, and nudges only in the day and not too often", () => {
    const summary = summarize(todos, NOW);

    expect(summary).toEqual({ open: 4, dueToday: 1, overdue: 1 });
    expect(shouldNudge(summary, EMPTY_REMINDER_STATE, NOW)).toBe(true);
    expect(shouldNudge(summary, { ...EMPTY_REMINDER_STATE, lastNudge: NOW.getTime() - 60_000 }, NOW)).toBe(false);
    expect(shouldNudge(summary, EMPTY_REMINDER_STATE, new Date(2026, 10, 21, 22, 0))).toBe(false);
    expect(shouldNudge(summary, EMPTY_REMINDER_STATE, new Date(2026, 10, 21, 8, 0))).toBe(false);
    expect(shouldNudge({ ...summary, overdue: 0 }, EMPTY_REMINDER_STATE, NOW)).toBe(false);
  });
});

describe("background scheduler", () => {
  let device: ReturnType<typeof createDevice>;
  let api: TBackgroundApi;
  let alarms: Map<string, { when?: number; periodInMinutes?: number }>;
  let shown: Array<{ id: string; title: string; message: string; buttons?: Array<{ title: string }> }>;
  let granted: boolean;
  let clock: Date;
  let badge: { text: string; color: string };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    device = createDevice();
    alarms = new Map();
    shown = [];
    granted = true;
    clock = NOW;
    badge = { text: "", color: "" };

    api = {
      repository: device.repository,
      alarms: {
        create: (name, info) => alarms.set(name, "when" in info ? { when: info.when } : { periodInMinutes: info.periodInMinutes }),
        clear: name => alarms.delete(name),
        get: async (name) => {
          const alarm = alarms.get(name);

          return alarm === undefined ? undefined : { scheduledTime: alarm.when ?? 0 };
        },
      },
      notify: async (id, options) => {
        if (!granted) {
          return false;
        }

        shown.push({ id, ...options });

        return true;
      },
      clearNotification: async () => true,
      canNotify: async () => granted,
      setBadge: async (text, color) => {
        badge = { text, color };
      },
      local: memoryArea(),
      session: memoryArea("session"),
      supportsButtons: true,
      t: (key, substitutions) => `${key}${substitutions === undefined ? "" : `(${[substitutions].flat().join(",")})`}`,
      now: () => clock,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows due reminders with buttons and sets the badge and the next wake-up", async () => {
    await device.repository.savePrefs({ reminders: true, lead: 0 });
    await device.repository.add("Call Sam", { due: "2026-11-21T10:00" });
    await device.repository.add("Later", { due: "2026-11-21T17:00" });

    const scheduler = createScheduler(api);

    await scheduler.refresh();

    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatchObject({ title: "Call Sam", buttons: [{ title: "notify.done" }, { title: "notify.snooze" }] });
    expect(shown[0]!.message).toMatch(/^notify.overdue/);
    expect(badge).toEqual({ text: "2", color: "#d93a33" });
    expect(alarms.get(ALARMS.reminders)?.when).toBe(new Date(2026, 10, 21, 17, 0).getTime());

    // Not shown twice.
    await scheduler.refresh();
    expect(shown).toHaveLength(1);
  });

  it("stays quiet without the permission or with reminders off, and has no buttons on Firefox", async () => {
    await device.repository.add("Call Sam", { due: "2026-11-21T10:00" });

    const scheduler = createScheduler({ ...api, supportsButtons: false });

    await scheduler.refresh();
    expect(shown).toEqual([]);

    await device.repository.savePrefs({ reminders: true });
    granted = false;
    await scheduler.refresh();
    expect(shown).toEqual([]);

    granted = true;
    await scheduler.refresh();
    expect(shown[0]).not.toHaveProperty("buttons");
  });

  it("checks a to-do off or snoozes it from the notification", async () => {
    await device.repository.savePrefs({ reminders: true });

    const daily = await device.repository.add("Pills", { due: "2026-11-21T10:00", repeat: "1d" });
    const once = await device.repository.add("Call", { due: "2026-11-21T10:10" });
    const scheduler = createScheduler(api);

    await scheduler.refresh();
    expect(shown.map(s => s.id)).toEqual([`due:${daily.id}`, `due:${once.id}`]);

    await scheduler.onButton(`due:${daily.id}`, 0);
    await scheduler.onButton(`due:${once.id}`, 1);

    const { todos } = await device.repository.load();

    expect(todos.find(t => t.id === daily.id)).toMatchObject({ done: false, due: "2026-11-22T10:00" });
    expect(todos.find(t => t.id === once.id)).toMatchObject({ done: false });

    // The snooze reminds again ten minutes later.
    clock = new Date(NOW.getTime() + 11 * 60_000);
    shown = [];
    await scheduler.refresh();
    expect(shown.map(s => s.id)).toEqual([`due:${once.id}`]);

    // Unknown notifications and to-dos are ignored.
    await scheduler.onButton("digest", 0);
    await scheduler.onButton("due:missing", 0);
  });

  it("marks a one-off to-do done from the notification", async () => {
    await device.repository.savePrefs({ reminders: true });

    const once = await device.repository.add("Call", { due: "2026-11-21T10:10" });
    const scheduler = createScheduler(api);

    await scheduler.refresh();
    await scheduler.onButton(`due:${once.id}`, 0);
    expect((await device.repository.load()).todos[0]).toMatchObject({ done: true });
  });

  it("schedules the daily digest and sends it", async () => {
    await device.repository.savePrefs({ digest: "09:00" });
    await device.repository.add("Overdue", { due: "2026-11-20" });

    const scheduler = createScheduler(api);

    await scheduler.refresh();
    expect(alarms.get(ALARMS.digest)?.when).toBe(new Date(2026, 10, 22, 9, 0).getTime());

    await scheduler.onAlarm(ALARMS.digest);
    expect(shown).toEqual([{ id: "digest", title: "notify.digestTitle", message: "notify.digest(1,0,1)" }]);

    await device.repository.savePrefs({ digest: null });
    await scheduler.refresh();
    expect(alarms.has(ALARMS.digest)).toBe(false);
  });

  it("nudges about overdue to-dos at most every few hours", async () => {
    await device.repository.savePrefs({ nudges: true });
    await device.repository.add("Overdue", { due: "2026-11-20" });

    const scheduler = createScheduler(api);

    await scheduler.refresh();
    expect(alarms.get(ALARMS.nudge)?.periodInMinutes).toBe(60);

    // An existing nudge alarm is left alone, so its period isn't restarted.
    alarms.set(ALARMS.nudge, { periodInMinutes: 999 });
    await scheduler.refresh();
    expect(alarms.get(ALARMS.nudge)?.periodInMinutes).toBe(999);

    await scheduler.onAlarm(ALARMS.nudge);
    await scheduler.onAlarm(ALARMS.nudge);
    expect(shown.map(s => s.id)).toEqual(["nudge"]);
    expect(((await api.local.get(REMINDER_STATE_KEY))[REMINDER_STATE_KEY] as { lastNudge: number }).lastNudge).toBe(NOW.getTime());

    await device.repository.savePrefs({ nudges: false });
    await scheduler.refresh();
    expect(alarms.has(ALARMS.nudge)).toBe(false);
  });

  it("turns the badge off and clears the wake-up when there's nothing to wait for", async () => {
    await device.repository.savePrefs({ badge: "off" });

    const scheduler = createScheduler(api);

    alarms.set(ALARMS.reminders, { when: 1 });
    await scheduler.refresh();
    expect(badge.text).toBe("");
    expect(alarms.has(ALARMS.reminders)).toBe(false);

    await scheduler.onAlarm("unrelated");
    await scheduler.onAlarm(ALARMS.reminders);
  });

  it("sends no digest when nothing is open", async () => {
    await device.repository.savePrefs({ digest: "09:00" });

    const scheduler = createScheduler(api);

    await scheduler.onAlarm(ALARMS.digest);
    expect(shown).toEqual([]);
    expect(DEFAULT_PREFS.badge).toBe("due");
  });

  it("reminds ahead of time, and still wakes up for reminders with the badge off", async () => {
    await device.repository.savePrefs({ reminders: true, lead: 10, badge: "off" });
    await device.repository.add("Call Sam", { due: "2026-11-21T10:35" });
    await device.repository.add("Later", { due: "2026-11-21T17:00" });

    await createScheduler(api).refresh();

    expect(shown).toEqual([{ id: expect.stringMatching(/^due:/), title: "Call Sam", message: expect.stringMatching(/^notify\.due\(/), buttons: [{ title: "notify.done" }, { title: "notify.snooze" }] }]);
    expect(badge.text).toBe("");
    expect(alarms.get(ALARMS.reminders)?.when).toBe(new Date(2026, 10, 21, 16, 50).getTime());
  });

  describe("focus timer", () => {
    it("counts down on the badge and wakes up at the end", async () => {
      await device.repository.add("Due", { due: "2026-11-21T09:00" });
      await saveTimer(api.session, createTimer(25, null, NOW));

      const scheduler = createScheduler(api);

      await scheduler.refresh();
      expect(badge).toEqual({ text: "25m", color: "#1f8a68" });
      expect(alarms.get(ALARMS.focusEnd)?.when).toBe(NOW.getTime() + 25 * 60_000);
      expect(alarms.get(ALARMS.focusTick)?.periodInMinutes).toBe(1);

      clock = new Date(NOW.getTime() + 10 * 60_000 + 1);
      await scheduler.onAlarm(ALARMS.focusTick);
      expect(badge.text).toBe("15m");
    });

    it("ignores an early end alarm, then finishes with a notification", async () => {
      const added = await device.repository.add("Write report");

      await saveTimer(api.session, createTimer(5, added.id, NOW));

      const scheduler = createScheduler(api);

      clock = new Date(NOW.getTime() + 2 * 60_000);
      await scheduler.onAlarm(ALARMS.focusEnd);
      expect(await readTimer(api.session)).not.toBeNull();
      expect(shown).toEqual([]);

      clock = new Date(NOW.getTime() + 5 * 60_000 - 500);
      await scheduler.onAlarm(ALARMS.focusEnd);
      expect(await readTimer(api.session)).toBeNull();
      expect(shown).toEqual([{ id: "focus", title: "notify.focusTitle", message: "notify.focusTodo(Write report)" }]);
      expect(alarms.has(ALARMS.focusEnd)).toBe(false);
      expect(alarms.has(ALARMS.focusTick)).toBe(false);
      expect(badge.text).toBe("");
    });

    it("finishes a timer that ran out while asleep, quietly without the permission", async () => {
      await saveTimer(api.session, createTimer(5, "gone", NOW));
      granted = false;
      clock = new Date(NOW.getTime() + 60 * 60_000);

      await createScheduler(api).refresh();
      expect(await readTimer(api.session)).toBeNull();
      expect(shown).toEqual([]);

      granted = true;
      await saveTimer(api.session, createTimer(5, "gone", NOW));
      await createScheduler(api).onAlarm(ALARMS.focusEnd);
      expect(shown[0]?.message).toBe("notify.focus");

      await saveTimer(api.session, createTimer(5, null, NOW));
      await createScheduler(api).onAlarm(ALARMS.focusEnd);
      expect(shown[1]?.message).toBe("notify.focus");
    });

    it("does nothing at the end alarm when no timer runs", async () => {
      await createScheduler(api).onAlarm(ALARMS.focusEnd);
      expect(shown).toEqual([]);
      expect(await api.session.get(TIMER_KEY)).toEqual({});
    });
  });
});
