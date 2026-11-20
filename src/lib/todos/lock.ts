import type { TMaybePromise } from "@eoussama/core";



let fallbackQueue: Promise<unknown> = Promise.resolve();

/**
 * Runs a task while holding a named lock. Uses the Web Locks API, which every
 * page and the background of the extension share, so the popup and the
 * background never write the same keys at the same time. Falls back to an
 * in-memory queue where the API is missing.
 *
 * @param name The lock name.
 * @param task The work to do while holding the lock.
 * @returns What the task returns.
 */
export async function withLock<T>(name: string, task: () => TMaybePromise<T>): Promise<T> {
  const locks = globalThis.navigator?.locks;

  if (locks !== undefined) {
    return locks.request(name, async () => task());
  }

  const run = fallbackQueue.then(task);

  fallbackQueue = run.catch(() => undefined);

  return run;
}
