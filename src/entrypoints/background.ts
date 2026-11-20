import { FLUSH_ALARM } from "~/lib/todos/limits";
import { createTodoRepository } from "~/lib/todos/sync-repository";



/**
 * Writes pending changes to sync when no popup is open: after the popup
 * closes (via the alarm the repository sets), on install and on startup.
 */
export default defineBackground(() => {
  const repository = createTodoRepository();

  const flush = (): void => {
    repository.flush().catch((error: unknown) => console.error("[swift-todo] Could not write pending changes.", error));
  };

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === FLUSH_ALARM) {
      flush();
    }
  });

  browser.runtime.onInstalled.addListener(flush);
  browser.runtime.onStartup.addListener(flush);
});
