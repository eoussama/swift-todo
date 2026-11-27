import type { TPrefs } from "../prefs/prefs";
import type { TList } from "./lists";
import type { TTodo, TTodoFields, TTrashedTodo } from "./model";
import type { TImportData, TImportMode, TImportResult, TStorageStatus, TTodoPatch, TTodoRepository } from "./repository";
import type { TSort } from "./sort";
import type { TListFilter } from "./view";

import { tryCatch } from "@eoussama/core";

import { DEFAULT_PREFS } from "../prefs/prefs";
import { anchorRule } from "../time/recur";
import { completeTodo } from "./complete";
import { TodoError } from "./errors";
import { DEFAULT_SYNC_LIMITS } from "./limits";
import { createListId, MAX_LISTS, normalizeEmoji, normalizeListName } from "./lists";
import { lastPosition } from "./ordering";
import { DEFAULT_SORT, withSort } from "./sort";
import { BUILT_IN_FILTERS, filterTodos, resolveFilter } from "./view";



const REFRESH_DEBOUNCE_MS = 30;

/** Device-only UI state: which list the popup shows. */
export type TUiState = {
  loadFilter: () => Promise<TListFilter | null>;
  saveFilter: (filter: TListFilter) => Promise<void>;
};

export type TStoreOptions = {
  ui?: TUiState;
  /** Decides what's in the Today view. */
  isToday?: (todo: TTodo) => boolean;
  /** Clock, replaceable in tests. */
  now?: () => Date;
};

const INITIAL_STATUS: TStorageStatus = {
  mode: "sync",
  pending: 0,
  synced: 0,
  deviceOnly: 0,
  keptOnDevice: 0,
  usage: { bytes: 0, quotaBytes: DEFAULT_SYNC_LIMITS.quotaBytes, items: 0, maxItems: DEFAULT_SYNC_LIMITS.maxItems, ratio: 0 },
  retryAt: null,
};

/**
 * Reactive to-do list for the UI. Every action goes through the repository,
 * and the list reloads whenever storage changes, including changes made by
 * the background or another device.
 */
export class TodoStore {
  todos = $state<Array<TTodo>>([]);
  /** Deleted to-dos on this device, newest first. */
  trash = $state<Array<TTrashedTodo>>([]);
  status = $state<TStorageStatus>(INITIAL_STATUS);
  /** User lists, in order. The Inbox is implicit. */
  lists = $state<Array<TList>>([]);
  prefs = $state<TPrefs>({ ...DEFAULT_PREFS });
  ready = $state(false);
  /** Loaded from storage at least once: until then, an empty list doesn't mean there are no to-dos. */
  loaded = $state(false);
  error = $state<Error | null>(null);

  /** The chosen list filter; see {@link TodoStore.activeFilter} for the one in effect. */
  filter = $state<TListFilter>("all");
  /** Only to-dos with this tag, or `null` for all. */
  tagFilter = $state<string | null>(null);

  /** The filter in effect: the chosen one, or "all" when its list is gone. */
  readonly activeFilter = $derived(resolveFilter(this.filter, this.lists));
  /** The to-dos shown for the current list and tag. */
  readonly visible = $derived.by(() => filterTodos(this.todos, {
    filter: this.activeFilter,
    tag: this.tagFilter,
    lists: this.lists,
    isToday: this.options.isToday,
  }));

  /** How the current list is sorted. */
  readonly sort = $derived(this.sortOf(this.activeFilter));

  readonly remaining = $derived(this.visible.filter(todo => !todo.done).length);
  readonly completed = $derived(this.visible.length - this.remaining);

  private refreshTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Creates a store.
   *
   * @param repository Where the to-dos are stored.
   * @param options Device UI state and the Today rule.
   */
  constructor(private readonly repository: TTodoRepository, private readonly options: TStoreOptions = {}) {}

  /**
   * Loads the list and starts following storage changes.
   *
   * @returns A function that stops following them.
   */
  async start(): Promise<() => void> {
    // Stryker disable next-line OptionalChaining: without UI state the call fails inside tryCatch, like a failed load.
    const [, saved] = await tryCatch(async () => this.options.ui?.loadFilter());

    if (typeof saved === "string") {
      this.filter = saved;
    }

    await this.refresh();
    this.ready = true;

    const unsubscribe = this.repository.subscribe((area) => {
      this.queueRefresh();

      // Another device may have freed sync space for device-only to-dos.
      if (area === "sync" && this.status.deviceOnly > 0) {
        void this.flush();
      }
    });

    void this.flush();

    return () => {
      unsubscribe();
      clearTimeout(this.refreshTimer);
    };
  }

  /**
   * Reloads the list and status from storage.
   *
   * @returns Once reloaded.
   */
  async refresh(): Promise<void> {
    const [error, snapshot] = await tryCatch(async () => this.repository.load());

    if (error !== null) {
      this.error = error;

      return;
    }

    this.todos = snapshot.todos;
    this.trash = snapshot.trash;
    this.lists = snapshot.lists;
    this.prefs = snapshot.prefs;
    this.status = snapshot.status;
    this.loaded = true;
  }

  /**
   * Adds a to-do at the end of the list.
   *
   * @param text The to-do text.
   * @param fields Optional details: list, due, repeat, source, today.
   * @returns The new to-do, or `undefined` when it was refused (see {@link TodoStore.error}).
   */
  async add(text: string, fields?: Partial<TTodoFields>): Promise<TTodo | undefined> {
    const anchored = fields?.repeat === undefined ? fields : { ...fields, repeat: anchorRule(fields.repeat, fields.due ?? null) };

    return this.run(async () => this.repository.add(text, anchored));
  }

  /**
   * Changes the text or done state of a to-do.
   *
   * @param id The to-do ID.
   * @param patch The fields to change.
   * @returns Once saved.
   */
  async update(id: string, patch: TTodoPatch): Promise<void> {
    await this.run(async () => this.repository.update(id, this.anchored(id, patch)));
  }

  // A monthly repeat keeps the day it repeats on (see anchorRule) when its rule or date is set by hand.
  // A rule the patch doesn't set is only written when the date moves its day: the rule shown here
  // may be behind one changed on another device.
  private anchored(id: string, patch: TTodoPatch): TTodoPatch {
    const todo = this.todos.find(item => item.id === id);

    if (todo === undefined || (patch.due === undefined && patch.repeat === undefined)) {
      return patch;
    }

    const repeat = anchorRule(patch.repeat === undefined ? todo.repeat : patch.repeat, patch.due === undefined ? todo.due : patch.due, todo);

    return patch.repeat === undefined && repeat === todo.repeat ? patch : { ...patch, repeat };
  }

  /**
   * Flips a to-do between done and not done. Checking off a repeating to-do
   * moves it to its next due date instead.
   *
   * @param id The to-do ID.
   * @returns The next due date of a repeating to-do, `null` otherwise, or `undefined` when nothing happened.
   */
  async toggle(id: string): Promise<string | null | undefined> {
    const todo = this.todos.find(item => item.id === id);

    if (todo === undefined) {
      return undefined;
    }

    if (todo.done) {
      await this.update(id, { done: false });

      return null;
    }

    // A moment passed along, not reactive state.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    return this.run(async () => completeTodo(this.repository, todo, this.options.now?.() ?? new Date(), lastPosition(this.todos)));
  }

  /**
   * Deletes a to-do.
   *
   * @param id The to-do ID.
   * @returns The removed to-do, for undo.
   */
  async remove(id: string): Promise<TTodo | null | undefined> {
    return this.run(async () => this.repository.remove(id));
  }

  /**
   * Puts removed to-dos back where they were.
   *
   * @param todos The to-dos to restore.
   * @returns Once saved.
   */
  async restore(todos: ReadonlyArray<TTodo>): Promise<void> {
    await this.run(async () => this.repository.restore(todos));
  }

  /**
   * Moves a to-do within the list, updating the UI right away.
   *
   * @param id The to-do ID.
   * @param toIndex Index it should end up at.
   * @returns Once saved.
   */
  async move(id: string, toIndex: number): Promise<void> {
    const from = this.todos.findIndex(todo => todo.id === id);

    if (from === -1 || from === toIndex) {
      return;
    }

    // Reorder right away so drag and drop doesn't snap back while saving.
    const reordered = [...this.todos];
    const [moved] = reordered.splice(from, 1);

    reordered.splice(toIndex, 0, moved!);
    this.todos = reordered;

    await this.run(async () => this.repository.move(id, toIndex));
  }

  /**
   * Chooses whether a to-do is synced. Refusals (sync full or off) end up in
   * {@link TodoStore.error} with the `sync-full` or `sync-unavailable` code.
   *
   * @param id The to-do ID.
   * @param synced Whether the to-do should be synced.
   * @returns Once saved or refused.
   */
  async setSynced(id: string, synced: boolean): Promise<void> {
    await this.run(async () => this.repository.setSynced(id, synced));
  }

  /**
   * Moves done to-dos to the trash: every one, or only those given.
   *
   * @param ids Limits the clearing to these to-dos, for example the current list's.
   * @returns The removed to-dos, for undo.
   */
  async clearCompleted(ids?: ReadonlyArray<string>): Promise<Array<TTodo> | undefined> {
    return this.run(async () => this.repository.clearCompleted(ids));
  }

  /**
   * Moves to-dos to the trash, done or not, as one change.
   *
   * @param ids The to-dos, for example every one in a list.
   * @returns The removed to-dos, for undo.
   */
  async removeMany(ids: ReadonlyArray<string>): Promise<Array<TTodo> | undefined> {
    return this.run(async () => this.repository.removeMany(ids));
  }

  /**
   * Creates a list at the end.
   *
   * @param name The list name.
   * @param emoji An optional emoji.
   * @returns The new list, or `undefined` when refused (blank name, or too many lists).
   */
  async addList(name: string, emoji: string | null = null): Promise<TList | undefined> {
    return this.run(async () => {
      const clean = normalizeListName(name);

      if (clean.length === 0) {
        throw new TodoError("empty");
      }

      if (this.lists.length >= MAX_LISTS) {
        throw new TodoError("too-many-lists");
      }

      const list: TList = { id: createListId(), name: clean, emoji: normalizeEmoji(emoji) };

      await this.repository.saveLists([...this.lists, list]);

      return list;
    });
  }

  /**
   * Renames a list or changes its emoji.
   *
   * @param id The list ID.
   * @param name The new name.
   * @param emoji The new emoji, or `null` for none.
   * @returns Once saved.
   */
  async renameList(id: string, name: string, emoji: string | null): Promise<void> {
    await this.run(async () => {
      const clean = normalizeListName(name);

      if (clean.length === 0) {
        throw new TodoError("empty");
      }

      await this.repository.saveLists(this.lists.map(list => (list.id === id ? { ...list, name: clean, emoji: normalizeEmoji(emoji) } : list)));
    });
  }

  /**
   * Moves a list one place up or down.
   *
   * @param id The list ID.
   * @param delta -1 for up, 1 for down.
   * @returns Once saved.
   */
  async moveList(id: string, delta: -1 | 1): Promise<void> {
    const from = this.lists.findIndex(list => list.id === id);
    const to = from + delta;

    if (from === -1 || to < 0 || to >= this.lists.length) {
      return;
    }

    const lists = [...this.lists];
    const [moved] = lists.splice(from, 1);

    lists.splice(to, 0, moved!);
    await this.run(async () => this.repository.saveLists(lists));
  }

  /**
   * Deletes a list; its to-dos move to the Inbox.
   *
   * @param id The list ID.
   * @returns Once saved.
   */
  async deleteList(id: string): Promise<void> {
    await this.run(async () => this.repository.deleteList(id));
  }

  /**
   * Changes some settings.
   *
   * @param patch The settings to change.
   * @returns Once saved.
   */
  async savePrefs(patch: Partial<TPrefs>): Promise<void> {
    // Apply right away so the UI reacts without waiting for storage.
    this.prefs = { ...this.prefs, ...patch };
    await this.run(async () => this.repository.savePrefs(patch));
  }

  /**
   * Imports a backup.
   *
   * @param data The validated backup.
   * @param mode Merge with or replace the current to-dos.
   * @returns What was imported, or `undefined` when it failed.
   */
  async importData(data: TImportData, mode: TImportMode): Promise<TImportResult | undefined> {
    return this.run(async () => this.repository.importData(data, mode));
  }

  /**
   * Puts a trashed to-do back in the list.
   *
   * @param id The to-do ID.
   * @returns Once restored.
   */
  async restoreFromTrash(id: string): Promise<void> {
    const todo = this.trash.find(item => item.id === id);

    if (todo !== undefined) {
      await this.restore([todo]);
    }
  }

  /**
   * Deletes a trashed to-do for good.
   *
   * @param id The to-do ID.
   * @returns Once deleted.
   */
  async deleteForever(id: string): Promise<void> {
    await this.run(async () => this.repository.deleteForever(id));
  }

  /**
   * Deletes every trashed to-do for good.
   *
   * @returns How many were deleted.
   */
  async emptyTrash(): Promise<number | undefined> {
    return this.run(async () => this.repository.emptyTrash());
  }

  /**
   * Writes pending changes to sync now.
   *
   * @returns Once done or rescheduled.
   */
  async flush(): Promise<void> {
    await this.run(async () => this.repository.flush());
  }

  /**
   * Shows another list (or All, Inbox, Today), remembered on this device.
   *
   * @param filter The list filter.
   * @returns Once remembered.
   */
  async setFilter(filter: TListFilter): Promise<void> {
    this.filter = filter;
    // Stryker disable next-line OptionalChaining: without UI state the call fails inside tryCatch, like a failed save.
    await tryCatch(async () => this.options.ui?.saveFilter(filter));
  }

  /**
   * Tells how a list (or All, Today, Inbox) is sorted.
   *
   * @param filter The list or view.
   * @returns Its sort; by hand unless another was chosen.
   */
  sortOf(filter: TListFilter): TSort {
    return this.prefs.sorts[filter] ?? DEFAULT_SORT;
  }

  /**
   * Sorts a list (or All, Today, Inbox) another way, on every device.
   *
   * @param filter The list or view.
   * @param sort The new sort.
   * @returns Once saved.
   */
  async setSort(filter: TListFilter, sort: TSort): Promise<void> {
    if (this.sortOf(filter) === sort) {
      return;
    }

    // Lists deleted since are dropped along the way.
    const exists = (id: string): boolean => (BUILT_IN_FILTERS as ReadonlyArray<string>).includes(id) || this.lists.some(list => list.id === id);

    await this.savePrefs({ sorts: withSort(this.prefs.sorts, filter, sort, exists) });
  }

  /**
   * Shows only to-dos with a tag, or all of them again.
   *
   * @param tag The tag, without `#`, or `null` to clear the filter.
   */
  setTagFilter(tag: string | null): void {
    this.tagFilter = tag;
  }

  /** Clears the last error. */
  dismissError(): void {
    this.error = null;
  }

  private async run<T>(action: () => Promise<T>): Promise<T | undefined> {
    const [error, result] = await tryCatch(action);

    this.error = error;
    await this.refresh();

    return error === null ? result : undefined;
  }

  private queueRefresh(): void {
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => void this.refresh(), REFRESH_DEBOUNCE_MS);
  }
}
