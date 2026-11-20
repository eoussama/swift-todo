import type { Mock } from "vitest";
import type { TRepositoryOptions, TStorageArea } from "~/lib/todos/sync-repository";
import type { TBudgetArea } from "~/lib/todos/write-budget";

import { vi } from "vitest";

import { DEFAULT_SYNC_LIMITS } from "~/lib/todos/limits";
import { SyncTodoRepository } from "~/lib/todos/sync-repository";



type TListener = (changes: Record<string, unknown>, area: string) => void;

/** A storage area kept in memory. Values are cloned like the browser serializes them. */
export type TMemoryArea = TStorageArea & TBudgetArea & { data: Map<string, unknown> };

/**
 * Creates an in-memory storage area.
 *
 * @param name Area name reported to change listeners.
 * @param listeners Listeners to notify on every change.
 * @returns The area.
 */
export function memoryArea(name = "local", listeners: Set<TListener> = new Set()): TMemoryArea {
  const data = new Map<string, unknown>();

  const notify = (keys: Array<string>): void => {
    const changes = Object.fromEntries(keys.map(key => [key, {}]));

    for (const listener of listeners) {
      listener(changes, name);
    }
  };

  return {
    data,
    async get(keys?: null | string | Array<string>) {
      const wanted = keys === null || keys === undefined ? [...data.keys()] : Array.isArray(keys) ? keys : [keys];

      return Object.fromEntries(wanted.filter(key => data.has(key)).map(key => [key, structuredClone(data.get(key))]));
    },
    async set(items: Record<string, unknown>) {
      for (const [key, value] of Object.entries(items)) {
        data.set(key, structuredClone(value));
      }

      notify(Object.keys(items));
    },
    async remove(keys: string | Array<string>) {
      const list = Array.isArray(keys) ? keys : [keys];

      for (const key of list) {
        data.delete(key);
      }

      notify(list);
    },
  };
}

/** One simulated browser profile: its own local and session areas, sharing a sync area with other "devices". */
export type TDevice = {
  repository: SyncTodoRepository;
  sync: TMemoryArea;
  local: TMemoryArea;
  session: TMemoryArea;
  alarms: { create: Mock; clear: Mock };
  listeners: Set<TListener>;
  clock: { now: number };
};

/**
 * Creates a simulated device with a repository.
 *
 * @param options Overrides; pass another device's `sync` to share it.
 * @returns The device.
 */
export function createDevice(options: Partial<TRepositoryOptions> & { sync?: TMemoryArea | undefined; noSync?: boolean } = {}): TDevice {
  const listeners = new Set<TListener>();
  const sync = options.noSync === true ? undefined : (options.sync ?? memoryArea("sync", listeners));
  const local = memoryArea("local", listeners);
  const session = memoryArea("session");
  const alarms = { create: vi.fn(), clear: vi.fn() };
  const clock = { now: 1_000_000 };

  const repository = new SyncTodoRepository({
    local,
    session,
    alarms,
    limits: DEFAULT_SYNC_LIMITS,
    now: () => clock.now,
    onChanged: {
      addListener: listener => listeners.add(listener),
      removeListener: listener => listeners.delete(listener),
    },
    ...options,
    sync,
  });

  return { repository, sync: sync as TMemoryArea, local, session, alarms, listeners, clock };
}

/**
 * Lists the to-do texts in order.
 *
 * @param device The device to read from.
 * @returns The texts.
 */
export async function texts(device: TDevice): Promise<Array<string>> {
  return (await device.repository.load()).todos.map(todo => todo.text);
}
