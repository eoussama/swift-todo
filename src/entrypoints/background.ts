import { browser } from "wxt/browser";
import { i18n } from "#i18n";

import { captureItems } from "~/lib/capture";
import { hasNotifications } from "~/lib/permissions";
import { createScheduler } from "~/lib/time/runtime";
import { FLUSH_ALARM } from "~/lib/todos/limits";
import { sanitizeSource } from "~/lib/todos/model";
import { createTodoRepository } from "~/lib/todos/sync-repository";
import { readFilter } from "~/lib/ui-state";



/** Quiet period after storage changes before reminders and the badge are recomputed. */
const REFRESH_DEBOUNCE_MS = 1_000;

const CAPTURE_MENU = "swift-todo:add-selection";

/** How long the badge shows "+N" after adding to-dos from a selection. */
const FLASH_MS = 2_500;

/**
 * Runs without a popup open: writes pending changes to sync, keeps the
 * toolbar badge current, and shows reminders, the daily digest and nudges.
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

  // Right-click "Add to Swift TODO" on selected text: one to-do per line, linked to the page.
  const selectionIn = async (tabId: number | undefined, frameId: number | undefined): Promise<string | null> => {
    if (tabId === undefined) {
      return null;
    }

    try {
      // Read the selection with its line breaks; the menu's selectionText flattens them.
      const [result] = await browser.scripting.executeScript({
        target: { tabId, ...(frameId === undefined ? {} : { frameIds: [frameId] }) },
        func: () => globalThis.getSelection()?.toString() ?? "",
      });

      return typeof result?.result === "string" && result.result.trim().length > 0 ? result.result : null;
    }
    catch {
      return null;
    }
  };

  const capture = async (info: { selectionText?: string; pageUrl?: string; frameId?: number }, tab?: { id?: number; url?: string; title?: string }): Promise<void> => {
    const text = (await selectionIn(tab?.id, info.frameId)) ?? info.selectionText ?? "";
    const { lists } = await repository.load();
    const items = captureItems(text, {
      filter: await readFilter(browser.storage.local),
      lists,
      source: sanitizeSource(info.pageUrl ?? tab?.url, tab?.title),
      now: new Date(),
    });

    if (items.length === 0) {
      return;
    }

    await repository.addMany(items);
    flashUntil = Date.now() + FLASH_MS;
    await browser.action.setBadgeBackgroundColor({ color: "#39c89a" });
    await browser.action.setBadgeText({ text: `+${items.length}` });
    setTimeout(refresh, FLASH_MS);
  };

  const createMenu = async (): Promise<void> => {
    await browser.contextMenus.removeAll();
    browser.contextMenus.create({ id: CAPTURE_MENU, title: i18n.t("menu.addSelection"), contexts: ["selection"] });
  };

  browser.contextMenus.onClicked.addListener((info, tab) => {
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
