import type { TTodo } from "~/lib/todos/model";

import { describe, expect, it, vi } from "vitest";

import { focusQueue } from "~/lib/focus";
import { FocusTimer } from "~/lib/focus-timer.svelte";
import { Clock } from "~/lib/time/clock.svelte";
import { createTimer, formatClock, parseTimer, readTimer, remainingMs, saveTimer, TIMER_KEY, timerBadge } from "~/lib/time/timer";
import { isInToday, isPinnedToday } from "~/lib/time/today";

import { memoryArea } from "./helpers";



// Saturday 2026-11-21, 10:30 local time.
const NOW = new Date(2026, 10, 21, 10, 30);

function todo(id: string, fields: Partial<TTodo> = {}): TTodo {
  return { id, text: id, done: false, due: null, today: null, ...fields } as TTodo;
}

describe("today", () => {
  it("holds pinned, due and overdue to-dos, and done ones only on their day", () => {
    expect(isPinnedToday(todo("a", { today: "2026-11-21" }), NOW)).toBe(true);
    expect(isPinnedToday(todo("a", { today: "2026-11-20" }), NOW)).toBe(false);

    expect(isInToday(todo("pinned", { today: "2026-11-21", done: true }), NOW)).toBe(true);
    expect(isInToday(todo("stale pin", { today: "2026-11-20" }), NOW)).toBe(false);
    expect(isInToday(todo("none"), NOW)).toBe(false);
    expect(isInToday(todo("tonight", { due: "2026-11-21T23:30" }), NOW)).toBe(true);
    expect(isInToday(todo("overdue", { due: "2026-11-01" }), NOW)).toBe(true);
    expect(isInToday(todo("tomorrow", { due: "2026-11-22" }), NOW)).toBe(false);
    expect(isInToday(todo("done today", { due: "2026-11-21T08:00", done: true }), NOW)).toBe(true);
    expect(isInToday(todo("done before", { due: "2026-11-01", done: true }), NOW)).toBe(false);
  });
});

describe("focus queue", () => {
  const isToday = (item: TTodo) => isInToday(item, NOW);

  it("prefers open to-dos in Today, then the current view", () => {
    const todos = [todo("a"), todo("b", { today: "2026-11-21" }), todo("c", { due: "2026-11-01", done: true }), todo("d", { due: "2026-11-20" })];
    const plain = [todo("x"), todo("y", { done: true })];

    expect(focusQueue(todos, { visible: todos, isToday, skipped: [] }).map(item => item.id)).toEqual(["b", "d"]);
    expect(focusQueue(plain, { visible: plain, isToday, skipped: [] }).map(item => item.id)).toEqual(["x"]);
    expect(focusQueue([], { visible: [], isToday, skipped: [] })).toEqual([]);
  });

  it("puts skipped ones at the back, in the order they were skipped", () => {
    const todos = ["a", "b", "c", "d"].map(id => todo(id));

    expect(focusQueue(todos, { visible: todos, isToday, skipped: ["c", "a"] }).map(item => item.id)).toEqual(["b", "d", "c", "a"]);
  });
});

describe("timer", () => {
  it("reads stored timers defensively", () => {
    expect(parseTimer({ startedAt: 1, endsAt: 2, todo: "a" })).toEqual({ startedAt: 1, endsAt: 2, todo: "a" });
    expect(parseTimer({ startedAt: 1, endsAt: 2, todo: 5 })).toEqual({ startedAt: 1, endsAt: 2, todo: null });

    for (const value of [null, "x", { startedAt: 1 }, { startedAt: "1", endsAt: 2 }, { startedAt: 2, endsAt: 2 }, { startedAt: 1, endsAt: Number.NaN }]) {
      expect(parseTimer(value)).toBeNull();
    }
  });

  it("clamps the length and counts down", () => {
    expect(createTimer(25, "a", NOW)).toEqual({ startedAt: NOW.getTime(), endsAt: NOW.getTime() + 25 * 60_000, todo: "a" });
    expect(createTimer(0, null, NOW).endsAt - NOW.getTime()).toBe(60_000);
    expect(createTimer(999, null, NOW).endsAt - NOW.getTime()).toBe(180 * 60_000);
    expect(createTimer(4.6, null, NOW).endsAt - NOW.getTime()).toBe(5 * 60_000);

    const timer = createTimer(25, null, NOW);

    expect(remainingMs(timer, new Date(NOW.getTime() + 60_000))).toBe(24 * 60_000);
    expect(remainingMs(timer, new Date(NOW.getTime() + 26 * 60_000))).toBe(0);
    expect(timerBadge(timer, new Date(NOW.getTime() + 61_000))).toBe("24m");
    expect(timerBadge(timer, NOW)).toBe("25m");
  });

  it("formats time left as a clock", () => {
    expect(formatClock(25 * 60_000)).toBe("25:00");
    expect(formatClock(59_001)).toBe("1:00");
    expect(formatClock(9_000)).toBe("0:09");
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(62 * 60_000)).toBe("1:02:00");
    expect(formatClock(3_600_000 + 5_000)).toBe("1:00:05");
  });

  it("saves and clears the running timer", async () => {
    const area = memoryArea("session");
    const timer = createTimer(5, null, NOW);

    expect(await readTimer(area)).toBeNull();
    await saveTimer(area, timer);
    expect(area.data.get(TIMER_KEY)).toEqual(timer);
    expect(await readTimer(area)).toEqual(timer);
    await saveTimer(area, null);
    expect(area.data.has(TIMER_KEY)).toBe(false);
  });
});

describe("focus timer in the popup", () => {
  type TChanges = Record<string, { oldValue?: unknown; newValue?: unknown }>;
  type TListener = (changes: TChanges, area: string) => void;

  function setup() {
    const area = memoryArea("session");
    const listeners = new Set<TListener>();
    const finished = vi.fn();
    const events = {
      addListener: (listener: TListener) => {
        listeners.add(listener);
      },
      removeListener: (listener: TListener) => {
        listeners.delete(listener);
      },
    };
    const emit = (changes: TChanges, name = "session"): void => listeners.forEach(listener => listener(changes, name));

    return { area, listeners, finished, emit, focus: new FocusTimer(area, events, finished) };
  }

  it("loads, starts and stops the timer", async () => {
    const { area, focus, listeners } = setup();
    const running = createTimer(10, null, new Date());

    await saveTimer(area, running);

    const stop = await focus.start();

    expect(focus.timer).toEqual(running);
    await focus.begin(25, "a");
    expect(focus.timer?.todo).toBe("a");
    expect(await readTimer(area)).toEqual(focus.timer);
    await focus.stop();
    expect(focus.timer).toBeNull();
    expect(await readTimer(area)).toBeNull();

    stop();
    expect(listeners.size).toBe(0);
  });

  it("follows changes, and tells when a timer ran out rather than stopped", async () => {
    const { focus, emit, finished } = setup();

    await focus.start();

    const ended = { startedAt: Date.now() - 60_000, endsAt: Date.now() };
    const stopped = { startedAt: Date.now(), endsAt: Date.now() + 600_000 };

    emit({ [TIMER_KEY]: { newValue: stopped } });
    expect(focus.timer).toEqual({ ...stopped, todo: null });

    emit({ [TIMER_KEY]: { oldValue: stopped } });
    expect(focus.timer).toBeNull();
    expect(finished).not.toHaveBeenCalled();

    emit({ [TIMER_KEY]: { oldValue: ended } });
    expect(finished).toHaveBeenCalledWith({ ...ended, todo: null });

    emit({ [TIMER_KEY]: { newValue: stopped } }, "local");
    emit({ other: { newValue: 1 } });
    expect(focus.timer).toBeNull();

    emit({ [TIMER_KEY]: {} });
    expect(finished).toHaveBeenCalledTimes(1);
  });

  it("has a default for when a timer finishes", async () => {
    const listeners: Array<TListener> = [];
    const focus = new FocusTimer(memoryArea("session"), { addListener: listener => listeners.push(listener), removeListener: () => {} });

    await focus.start();
    expect(() => listeners[0]!({ [TIMER_KEY]: { oldValue: { startedAt: 0, endsAt: 1 } } }, "session")).not.toThrow();
  });
});

describe("clock", () => {
  it("ticks until stopped", () => {
    vi.useFakeTimers();

    const clock = new Clock();
    const start = clock.now.getTime();
    const stop = clock.start(1_000);

    vi.advanceTimersByTime(3_000);
    expect(clock.now.getTime()).toBe(start + 3_000);
    stop();
    vi.advanceTimersByTime(3_000);
    expect(clock.now.getTime()).toBe(start + 3_000);

    new Clock().start()();
    vi.useRealTimers();
  });
});
