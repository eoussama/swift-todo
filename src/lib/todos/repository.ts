import type { TPrefs } from "../prefs/prefs";
import type { TList } from "./lists";
import type { TTodo, TTodoFields, TTrashedTodo } from "./model";



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
  /** Sorted in list order, across all lists. */
  todos: Array<TTodo>;
  /** Deleted to-dos, newest first. They live on this device only. */
  trash: Array<TTrashedTodo>;
  /** User lists, in order. The Inbox is implicit. */
  lists: Array<TList>;
  prefs: TPrefs;
  status: TStorageStatus;
};

/** What `update` can change. `null` clears an optional field. */
export type TTodoPatch = Partial<Pick<TTodo, "text" | "done" | "position"> & TTodoFields>;

/** Which storage area changed, as reported to subscribers. */
export type TChangedArea = "sync" | "local";

/** A backup to import (see `export/backup.ts`), already validated. */
export type TImportData = {
  todos: ReadonlyArray<TTodo>;
  lists: ReadonlyArray<TList>;
  prefs: TPrefs | null;
};

export type TImportMode = "merge" | "replace";

export type TImportResult = {
  added: number;
  skipped: number;
  /** In replace mode, the to-dos that were moved to the trash. */
  trashed: number;
};

export type TTodoRepository = {
  load: () => Promise<TTodoSnapshot>;
  /** Adds a to-do at the end of the list, with optional details. */
  add: (text: string, fields?: Partial<TTodoFields>) => Promise<TTodo>;
  /** Adds several to-dos at once, in order, as one change. */
  addMany: (items: ReadonlyArray<{ text: string; fields?: Partial<TTodoFields> }>) => Promise<Array<TTodo>>;
  update: (id: string, patch: TTodoPatch) => Promise<void>;
  /** Moves a to-do to the trash. @returns the removed to-do, for undo. */
  remove: (id: string) => Promise<TTodo | null>;
  /** Puts removed or trashed to-dos back with their IDs and positions. */
  restore: (todos: ReadonlyArray<TTodo>) => Promise<void>;
  /** Moves a to-do to `toIndex` in the sorted list of all to-dos. */
  move: (id: string, toIndex: number) => Promise<void>;
  /**
   * Chooses whether a to-do is synced. Turning sync off keeps it on the
   * device for good; turning it on fails with `sync-full` when it doesn't fit.
   */
  setSynced: (id: string, synced: boolean) => Promise<void>;
  /** Moves done to-dos (all, or only the given ones) to the trash. @returns the removed to-dos, for undo. */
  clearCompleted: (ids?: ReadonlyArray<string>) => Promise<Array<TTodo>>;
  /** Moves the given to-dos to the trash, done or not. @returns the removed to-dos, for undo. */
  removeMany: (ids: ReadonlyArray<string>) => Promise<Array<TTodo>>;
  /** Deletes a trashed to-do for good. */
  deleteForever: (id: string) => Promise<void>;
  /** Deletes every trashed to-do for good. @returns how many were deleted. */
  emptyTrash: () => Promise<number>;
  /** Replaces the user lists (create, rename, reorder). */
  saveLists: (lists: ReadonlyArray<TList>) => Promise<void>;
  /** Deletes a list and moves its to-dos to the Inbox. */
  deleteList: (id: string) => Promise<void>;
  /** Changes some settings. */
  savePrefs: (patch: Partial<TPrefs>) => Promise<void>;
  /** Imports a backup, merging with or replacing the current to-dos. */
  importData: (data: TImportData, mode: TImportMode) => Promise<TImportResult>;
  /** Writes pending changes to sync now, as far as the limits allow. */
  flush: () => Promise<void>;
  /** Calls `listener` when stored to-dos change in any extension context or on another device. */
  subscribe: (listener: (area: TChangedArea) => void) => () => void;
};
