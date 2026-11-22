import { browser } from "wxt/browser";
import { i18n } from "#i18n";

import { createCapture } from "~/lib/capture";
import { showCaptureToast } from "~/lib/capture-toast";
import { openPopup } from "~/lib/open-popup";
import { hasNotifications } from "~/lib/permissions";
import { createScheduler } from "~/lib/time/runtime";
import { TIMER_KEY } from "~/lib/time/timer";
import { FLUSH_ALARM } from "~/lib/todos/limits";
import { createTodoRepository } from "~/lib/todos/sync-repository";
import { readFilter } from "~/lib/ui-state";



/** Quiet period after storage changes before reminders and the badge are recomputed. */
const REFRESH_DEBOUNCE_MS = 1_000;

const CAPTURE_MENU = "swift-todo:add-selection";

/** How long the badge shows "+N" after adding to-dos from a selection. */
const FLASH_MS = 2_500;

/**
 * Runs without a popup open: writes pending changes to sync, keeps the
 * toolbar badge current, and shows reminders, the daily summary and nudges.
 */
export default defineBackground(() => {
  const repository = createTodoRepository();

  // While the badge flashes "+N" after a capture, regular badge updates wait.
  let flashUntil = 0;

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
      if (Date.now() < flashUntil) {
        return;
      }

      await browser.action.setBadgeText({ text });
      await browser.action.setBadgeBackgroundColor({ color });
      await browser.action.setBadgeTextColor?.({ color: "#ffffff" });
    },
    local: browser.storage.local,
    session: browser.storage.session,
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
  const showPopup = async (): Promise<void> => openPopup({
    lastWindow: async () => {
      const { id } = await browser.windows.getLastFocused({ windowTypes: ["normal"] });

      if (id === undefined) {
        throw new Error("No browser window");
      }

      return id;
    },
    focusWindow: async (id) => {
      await browser.windows.update(id, { focused: true });
    },
    openPopup: async windowId => browser.action.openPopup({ windowId }),
    createWindow: async () => (await browser.windows.create({ url: browser.runtime.getURL("/popup.html"), type: "popup", width: 400, height: 620 }))?.id,
    session: browser.storage.session,
  });

  // The notifications API only exists once its optional permission is granted.
  let listening = false;

  const listenToNotifications = (): void => {
    if (listening || browser.notifications === undefined) {
      return;
    }

    listening = true;
    browser.notifications.onClicked.addListener((id) => {
      void browser.notifications.clear(id);
      void showPopup().catch(report("open the popup"));
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

  // The popup starts and stops the focus timer in session storage.
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "session" && TIMER_KEY in changes) {
      refresh();
    }
  });

  // Right-click "Add to Swift TODO" on selected text: one to-do per line, linked to the page.
  const capture = createCapture({
    // Read the selection with its line breaks; the menu's selectionText flattens them.
    runInTab: async (tabId, frameId) => browser.scripting.executeScript({
      target: { tabId, ...(frameId === undefined ? {} : { frameIds: [frameId] }) },
      func: () => globalThis.getSelection()?.toString() ?? "",
    }),
    lists: async () => (await repository.load()).lists,
    filter: async () => readFilter(browser.storage.local),
    addMany: async items => repository.addMany(items),
    flash: async (count) => {
      flashUntil = Date.now() + FLASH_MS;
      await browser.action.setBadgeBackgroundColor({ color: "#39c89a" });
      await browser.action.setBadgeText({ text: `+${count}` });
      setTimeout(refresh, FLASH_MS);
    },
    // A note right where the text was selected. Pages that refuse scripts (the browser's own) keep just the badge.
    toast: async (tabId, count) => {
      await browser.scripting.executeScript({ target: { tabId }, func: showCaptureToast, args: [i18n.t("capture.added", count)] });
    },
    now: () => new Date(),
  });

  // Firefox for Android has no context menus.
  const menus = browser.contextMenus as typeof browser.contextMenus | undefined;

  const createMenu = async (): Promise<void> => {
    if (menus === undefined) {
      return;
    }

    await menus.removeAll();
    menus.create({ id: CAPTURE_MENU, title: i18n.t("menu.addSelection"), contexts: ["selection"] });
  };

  menus?.onClicked.addListener((info, tab) => {
    if (info.menuItemId === CAPTURE_MENU) {
      void capture(info, tab).catch(report("add the selection"));
    }
  });

  const start = (): void => {
    flush();
    refresh();
    void createMenu().catch(report("create the menu"));
  };

  browser.runtime.onInstalled.addListener(start);
  browser.runtime.onStartup.addListener(start);
});
