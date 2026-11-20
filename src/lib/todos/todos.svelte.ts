import type { TTodo } from "./model";
import type { TStorageStatus, TTodoPatch, TTodoRepository } from "./repository";

import { tryCatch } from "@eoussama/core";

import { DEFAULT_SYNC_LIMITS } from "./limits";



const REFRESH_DEBOUNCE_MS = 30;

const INITIAL_STATUS: TStorageStatus = {
  mode: "sync",
  pending: 0,
  deviceOnly: 0,
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
  status = $state<TStorageStatus>(INITIAL_STATUS);
  ready = $state(false);
  error = $state<Error | null>(null);

  readonly remaining = $derived(this.todos.filter(todo => !todo.done).length);
  readonly completed = $derived(this.todos.length - this.remaining);

  private refreshTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Creates a store.
   *
   * @param repository Where the to-dos are stored.
   */
  constructor(private readonly repository: TTodoRepository) {}

  /**
   * Loads the list and starts following storage changes.
   *
   * @returns A function that stops following them.
   */
  async start(): Promise<() => void> {
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
    this.status = snapshot.status;
  }

  /**
   * Adds a to-do at the end of the list.
   *
   * @param text The to-do text.
   * @returns The new to-do, or `undefined` when it was refused (see {@link TodoStore.error}).
   */
  async add(text: string): Promise<TTodo | undefined> {
    return this.run(async () => this.repository.add(text));
  }

  /**
   * Changes the text or done state of a to-do.
   *
   * @param id The to-do ID.
   * @param patch The fields to change.
   * @returns Once saved.
   */
  async update(id: string, patch: TTodoPatch): Promise<void> {
    await this.run(async () => this.repository.update(id, patch));
  }

  /**
   * Flips a to-do between done and not done.
   *
   * @param id The to-do ID.
   * @returns Once saved.
   */
  async toggle(id: string): Promise<void> {
    const todo = this.todos.find(item => item.id === id);

    if (todo !== undefined) {
      await this.update(id, { done: !todo.done });
    }
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
   * Deletes every done to-do.
   *
   * @returns The removed to-dos, for undo.
   */
  async clearCompleted(): Promise<Array<TTodo> | undefined> {
    return this.run(async () => this.repository.clearCompleted());
  }

  /**
   * Writes pending changes to sync now.
   *
   * @returns Once done or rescheduled.
   */
  async flush(): Promise<void> {
    await this.run(async () => this.repository.flush());
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
