import { browser } from "wxt/browser";
import { i18n } from "#i18n";

import { hasNotifications } from "~/lib/permissions";
import { createScheduler } from "~/lib/time/runtime";
import { FLUSH_ALARM } from "~/lib/todos/limits";
import { createTodoRepository } from "~/lib/todos/sync-repository";



/** Quiet period after storage changes before reminders and the badge are recomputed. */
const REFRESH_DEBOUNCE_MS = 1_000;

/**
 * Runs without a popup open: writes pending changes to sync, keeps the
 * toolbar badge current, and shows reminders, the daily digest and nudges.
 */
export default defineBackground(() => {
  const repository = createTodoRepository();

  const scheduler = createScheduler({
    repository,
    alarms: browser.alarms,
    notify: async (id, options) => {
      if (!(await hasNotifications())) {
        return false;
      }

      await browser.notifications.create(id, {
        type: "basic",
        iconUrl: browser.runtime.getURL("/icons/128.png"),
        title: options.title,
        message: options.message,
        ...(options.buttons === undefined ? {} : { buttons: options.buttons }),
      });

      return true;
    },
    clearNotification: async id => (await hasNotifications() ? browser.notifications.clear(id) : false),
    canNotify: hasNotifications,
    setBadge: async (text, color) => {
      await browser.action.setBadgeText({ text });
      await browser.action.setBadgeBackgroundColor({ color });
      await browser.action.setBadgeTextColor?.({ color: "#ffffff" });
    },
    local: browser.storage.local,
    supportsButtons: !import.meta.env.FIREFOX,
    t: (key, substitutions) => i18n.t(key as never, substitutions as never),
    now: () => new Date(),
  });

  const report = (what: string) => (error: unknown): void => console.error(`[swift-todo] Could not ${what}.`, error);

  const flush = (): void => {
    repository.flush().catch(report("write pending changes"));
  };

  let refreshTimer: ReturnType<typeof setTimeout> | undefined;

  const refresh = (): void => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => void scheduler.refresh().catch(report("update reminders")), REFRESH_DEBOUNCE_MS);
  };

  // Opens the popup from a notification, or a small window where the browser can't.
  const openPopup = async (): Promise<void> => {
    try {
      await browser.action.openPopup();
    }
    catch {
      await browser.windows.create({ url: browser.runtime.getURL("/popup.html"), type: "popup", width: 400, height: 620 });
    }
  };

  // The notifications API only exists once its optional permission is granted.
  let listening = false;

  const listenToNotifications = (): void => {
    if (listening || browser.notifications === undefined) {
      return;
    }

    listening = true;
    browser.notifications.onClicked.addListener((id) => {
      void browser.notifications.clear(id);
      void openPopup().catch(report("open the popup"));
    });
    browser.notifications.onButtonClicked?.addListener((id, index) => {
      void scheduler.onButton(id, index).catch(report("handle a notification button"));
    });
  };

  listenToNotifications();
  browser.permissions.onAdded.addListener(() => {
    listenToNotifications();
    refresh();
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === FLUSH_ALARM) {
      flush();
    }
    else {
      void scheduler.onAlarm(alarm.name).catch(report("handle an alarm"));
    }
  });

  repository.subscribe(refresh);

  const start = (): void => {
    flush();
    refresh();
  };

  browser.runtime.onInstalled.addListener(start);
  browser.runtime.onStartup.addListener(start);
});
