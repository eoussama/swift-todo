import type { TTodo } from "../todos/model";
import type { TTodoRepository } from "../todos/repository";
import type { TReminderState } from "./reminders";

import { completeTodo } from "../todos/complete";
import { nextTimeOfDay } from "./date";
import { formatDue } from "./format";
import { badgeFor, nextBadgeChange, parseReminderState, planReminders, shouldNudge, SNOOZE_MS, summarize } from "./reminders";
import { readTimer, remainingMs, saveTimer, timerBadge } from "./timer";



export const ALARMS = Object.freeze({
  reminders: "swift-todo:reminders",
  digest: "swift-todo:digest",
  nudge: "swift-todo:nudge",
  focusEnd: "swift-todo:focus-end",
  focusTick: "swift-todo:focus-tick",
});

/** A timer alarm this close to its end counts as finished; alarms can be a little early. */
const TIMER_SLACK_MS = 1_000;

/** Minutes between two checks for overdue to-dos. */
const NUDGE_PERIOD_MINUTES = 60;

export const REMINDER_STATE_KEY = "reminders:state";
export const DUE_PREFIX = "due:";

const BADGE_COLORS = { normal: "#242c88", alert: "#d93a33", focus: "#1f8a68" } as const;

export type TNotificationOptions = {
  title: string;
  message: string;
  buttons?: Array<{ title: string }>;
};

type TAlarmInfo = { when: number } | { delayInMinutes: number; periodInMinutes: number };

/** The browser APIs the background needs, passed in so they can be replaced in tests. */
export type TBackgroundApi = {
  repository: Pick<TTodoRepository, "load" | "update">;
  alarms: {
    create: (name: string, info: TAlarmInfo) => unknown;
    clear: (name: string) => unknown;
    get: (name: string) => Promise<{ scheduledTime: number } | undefined>;
  };
  /** Shows a notification; resolves to `false` when notifications aren't allowed here. */
  notify: (id: string, options: TNotificationOptions) => Promise<boolean>;
  clearNotification: (id: string) => Promise<unknown>;
  canNotify: () => Promise<boolean>;
  setBadge: (text: string, color: string) => Promise<unknown>;
  local: {
    get: (key: string) => Promise<Record<string, unknown>>;
    set: (items: Record<string, unknown>) => Promise<void>;
  };
  /** Session storage, where the focus timer runs. */
  session: {
    get: (key: string) => Promise<Record<string, unknown>>;
    set: (items: Record<string, unknown>) => Promise<void>;
    remove: (key: string) => Promise<void>;
  };
  /** Firefox notifications have no buttons. */
  supportsButtons: boolean;
  t: (key: string, substitutions?: Array<string> | number) => string;
  now: () => Date;
};

export type TScheduler = {
  /** Re-reads the to-dos: updates the badge, shows due reminders, and sets the next wake-up. */
  refresh: () => Promise<void>;
  onAlarm: (name: string) => Promise<void>;
  /** A notification button: 0 checks the to-do off, 1 snoozes it. */
  onButton: (notificationId: string, index: number) => Promise<void>;
};

/**
 * Creates the background scheduler for reminders, the digest, nudges and the badge.
 *
 * @param api The browser APIs.
 * @returns The scheduler.
 */
export function createScheduler(api: TBackgroundApi): TScheduler {
  async function readState(): Promise<TReminderState> {
    return parseReminderState((await api.local.get(REMINDER_STATE_KEY))[REMINDER_STATE_KEY]);
  }

  async function saveState(state: TReminderState): Promise<void> {
    await api.local.set({ [REMINDER_STATE_KEY]: state });
  }

  async function ensureAlarm(name: string, info: TAlarmInfo): Promise<void> {
    const existing = await api.alarms.get(name);

    // Re-creating a periodic alarm would restart its period, so leave it be.
    if (existing === undefined || ("when" in info && existing.scheduledTime !== info.when)) {
      await api.alarms.create(name, info);
    }
  }

  function reminderMessage(todo: TTodo, now: Date): TNotificationOptions {
    const due = formatDue(todo.due!, now);

    return {
      title: todo.text,
      message: api.t(due.overdue ? "notify.overdue" : "notify.due", [due.label]),
      ...(api.supportsButtons ? { buttons: [{ title: api.t("notify.done") }, { title: api.t("notify.snooze") }] } : {}),
    };
  }

  // While a focus timer runs, the badge counts its minutes down instead.
  async function refreshTimer(): Promise<"idle" | "running" | "finished"> {
    const timer = await readTimer(api.session);
    const now = api.now();

    if (timer === null) {
      await api.alarms.clear(ALARMS.focusEnd);
      await api.alarms.clear(ALARMS.focusTick);

      return "idle";
    }

    if (remainingMs(timer, now) <= TIMER_SLACK_MS) {
      await finishTimer();

      return "finished";
    }

    await api.setBadge(timerBadge(timer, now), BADGE_COLORS.focus);
    await ensureAlarm(ALARMS.focusEnd, { when: timer.endsAt });
    await ensureAlarm(ALARMS.focusTick, { delayInMinutes: 1, periodInMinutes: 1 });

    return "running";
  }

  async function finishTimer(): Promise<void> {
    const timer = await readTimer(api.session);

    if (timer === null || remainingMs(timer, api.now()) > TIMER_SLACK_MS) {
      await refresh();

      return;
    }

    // Clearing it changes session storage, which refreshes the badge.
    await saveTimer(api.session, null);

    if (await api.canNotify()) {
      const todo = timer.todo === null ? undefined : (await api.repository.load()).todos.find(item => item.id === timer.todo);

      await api.notify("focus", {
        title: api.t("notify.focusTitle"),
        message: todo === undefined ? api.t("notify.focus") : api.t("notify.focusTodo", [todo.text]),
      });
    }

    await refresh();
  }

  async function refresh(): Promise<void> {
    const timer = await refreshTimer();

    // Finishing the timer already refreshed everything.
    if (timer === "finished") {
      return;
    }

    const now = api.now();
    const { todos, prefs } = await api.repository.load();
    const badge = badgeFor(todos, prefs.badge, now);

    if (timer === "idle") {
      await api.setBadge(badge.text, badge.alert ? BADGE_COLORS.alert : BADGE_COLORS.normal);
    }

    let next = prefs.badge === "off" ? null : nextBadgeChange(todos, now);

    if (prefs.reminders && await api.canNotify()) {
      const plan = planReminders(todos, prefs, await readState(), now);

      for (const todo of plan.fire) {
        await api.notify(`${DUE_PREFIX}${todo.id}`, reminderMessage(todo, now));
      }

      await saveState(plan.state);

      if (plan.next !== null) {
        next = next === null ? plan.next : Math.min(next, plan.next);
      }
    }

    if (next === null) {
      await api.alarms.clear(ALARMS.reminders);
    }
    else {
      await api.alarms.create(ALARMS.reminders, { when: next });
    }

    if (prefs.digest === null) {
      await api.alarms.clear(ALARMS.digest);
    }
    else {
      await ensureAlarm(ALARMS.digest, { when: nextTimeOfDay(prefs.digest, now) });
    }

    if (prefs.nudges) {
      await ensureAlarm(ALARMS.nudge, { delayInMinutes: NUDGE_PERIOD_MINUTES, periodInMinutes: NUDGE_PERIOD_MINUTES });
    }
    else {
      await api.alarms.clear(ALARMS.nudge);
    }
  }

  async function digest(): Promise<void> {
    const now = api.now();
    const { todos, prefs } = await api.repository.load();
    const summary = summarize(todos, now);

    if (prefs.digest !== null && summary.open > 0 && await api.canNotify()) {
      await api.notify("digest", {
        title: api.t("notify.digestTitle"),
        message: api.t("notify.digest", [String(summary.open), String(summary.dueToday), String(summary.overdue)]),
      });
    }

    // Set tomorrow's digest.
    await refresh();
  }

  async function nudge(): Promise<void> {
    const now = api.now();
    const { todos, prefs } = await api.repository.load();
    const state = await readState();
    const summary = summarize(todos, now);

    if (prefs.nudges && shouldNudge(summary, state, now) && await api.canNotify()) {
      await api.notify("nudge", { title: api.t("notify.nudgeTitle"), message: api.t("notify.nudge", summary.overdue) });
      await saveState({ ...state, lastNudge: now.getTime() });
    }
  }

  async function onAlarm(name: string): Promise<void> {
    if (name === ALARMS.reminders) {
      await refresh();
    }
    else if (name === ALARMS.digest) {
      await digest();
    }
    else if (name === ALARMS.nudge) {
      await nudge();
    }
    else if (name === ALARMS.focusEnd) {
      await finishTimer();
    }
    else if (name === ALARMS.focusTick) {
      await refresh();
    }
  }

  async function onButton(notificationId: string, index: number): Promise<void> {
    if (!notificationId.startsWith(DUE_PREFIX)) {
      return;
    }

    const id = notificationId.slice(DUE_PREFIX.length);
    const todo = (await api.repository.load()).todos.find(item => item.id === id);

    await api.clearNotification(notificationId);

    if (todo === undefined) {
      return;
    }

    if (index === 0) {
      await completeTodo(api.repository, todo, api.now());
    }
    else {
      const state = await readState();
      const { [id]: _shown, ...notified } = state.notified;

      await saveState({ ...state, notified, snoozed: { ...state.snoozed, [id]: api.now().getTime() + SNOOZE_MS } });
    }

    await refresh();
  }

  return { refresh, onAlarm, onButton };
}
