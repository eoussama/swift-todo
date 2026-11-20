import type { TTodo } from "./model";



/** `sync` while browser sync storage works; `local` when it is off or unsupported. */
export type TStorageMode = "sync" | "local";

/** Projected use of the sync quotas, counting changes that are still waiting to be written. */
export type TStorageUsage = {
  bytes: number;
  quotaBytes: number;
  items: number;
  maxItems: number;
  /** Highest share of the byte or item quota in use, from 0 to 1. */
  ratio: number;
};

export type TStorageStatus = {
  mode: TStorageMode;
  /** Changes waiting to be written to sync. */
  pending: number;
  /** To-dos in sync, counting those waiting to be written. */
  synced: number;
  /** To-dos on this device only: kept there by the user, or waiting for sync space. */
  deviceOnly: number;
  /** Device-only to-dos the user chose to keep there; the rest move to sync once space frees up. */
  keptOnDevice: number;
  usage: TStorageUsage;
  /** When the next attempt to write pending changes is planned, if any. */
  retryAt: number | null;
};

export type TTodoSnapshot = {
  /** Sorted in list order. */
  todos: Array<TTodo>;
  status: TStorageStatus;
};

export type TTodoPatch = Partial<Pick<TTodo, "text" | "done">>;

/** Which storage area changed, as reported to subscribers. */
export type TChangedArea = "sync" | "local";

export type TTodoRepository = {
  load: () => Promise<TTodoSnapshot>;
  /** Adds a to-do at the end of the list. */
  add: (text: string) => Promise<TTodo>;
  update: (id: string, patch: TTodoPatch) => Promise<void>;
  /** @returns the removed to-do, for undo. */
  remove: (id: string) => Promise<TTodo | null>;
  /** Puts removed to-dos back with their IDs and positions. */
  restore: (todos: ReadonlyArray<TTodo>) => Promise<void>;
  /** Moves a to-do to `toIndex` in the sorted list. */
  move: (id: string, toIndex: number) => Promise<void>;
  /**
   * Chooses whether a to-do is synced. Turning sync off keeps it on the
   * device for good; turning it on fails with `sync-full` when it doesn't fit.
   */
  setSynced: (id: string, synced: boolean) => Promise<void>;
  /** @returns the removed to-dos, for undo. */
  clearCompleted: () => Promise<Array<TTodo>>;
  /** Writes pending changes to sync now, as far as the limits allow. */
  flush: () => Promise<void>;
  /** Calls `listener` when stored to-dos change in any extension context or on another device. */
  subscribe: (listener: (area: TChangedArea) => void) => () => void;
};
