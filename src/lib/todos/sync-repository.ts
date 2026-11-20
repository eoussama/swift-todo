import type { TSyncLimits, TSyncQuotaConstants } from "./limits";
import type { TTodo, TTodoLocation, TTodoRecord } from "./model";
import type { TChangedArea, TStorageMode, TStorageUsage, TTodoPatch, TTodoRepository, TTodoSnapshot } from "./repository";
import type { TBudgetArea } from "./write-budget";

import { isObject, tryCatch } from "@eoussama/core";
import { browser } from "wxt/browser";

import { classifyStorageError, TodoError } from "./errors";
import { FLUSH_ALARM, FLUSH_ALARM_DELAY_MINUTES, FLUSH_DEBOUNCE_MS, resolveSyncLimits, SAFETY, TODO_LIMITS } from "./limits";
import { withLock } from "./lock";
import { compareTodos, createId, decodeTodo, encodeTodo, idFromKey, isTodoRecord, normalizeText, readRecords, todoKey } from "./model";
import { planMove, positionAfter } from "./ordering";
import { areaBytes, itemBytes } from "./size";
import { WriteBudget } from "./write-budget";



/** The part of a storage area the repository uses. */
export type TStorageArea = {
  get: (keys?: null | string | Array<string>) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  remove: (keys: string | Array<string>) => Promise<void>;
};

type TStorageChangeListener = (changes: Record<string, unknown>, area: string) => void;

export type TRepositoryOptions = {
  /** `undefined` when the browser has no sync storage. */
  sync: TStorageArea | undefined;
  local: TStorageArea;
  /** Holds the write log shared by every extension context. */
  session: TBudgetArea;
  alarms?: {
    create: (name: string, info: { delayInMinutes: number }) => unknown;
    clear: (name: string) => unknown;
  };
  onChanged?: {
    addListener: (listener: TStorageChangeListener) => void;
    removeListener: (listener: TStorageChangeListener) => void;
  };
  limits?: TSyncLimits;
  now?: () => number;
};

type TOutboxEntry = { op: "put"; record: TTodoRecord } | { op: "delete" };
type TOutbox = Record<string, TOutboxEntry>;

type TState = {
  mode: TStorageMode;
  /** Raw dump of the sync area. */
  sync: Record<string, unknown>;
  syncRecords: Map<string, TTodoRecord>;
  deviceRecords: Map<string, TTodoRecord>;
  outbox: TOutbox;
};

type TChange = { id: string; record: TTodoRecord | null; location: TTodoLocation };

type TFlushStrategy = {
  /** Move device-only to-dos to sync when there is room. */
  promote: boolean;
  /** Keep to-dos that are not in sync yet on the device (after a quota error). */
  demoteNew: boolean;
  /** Keep every pending to-do on the device (after a second quota error). */
  demoteAll: boolean;
};

type TFlushPlan = {
  toSet: Record<string, unknown>;
  toRemove: Array<string>;
  /** To-dos that go to the device instead of sync. */
  demoted: Map<string, TTodoRecord>;
  /** Outbox entries this plan takes care of. */
  settled: Array<string>;
  /** Device keys to delete once sync has been written. */
  localRemove: Array<string>;
};

const OUTBOX_KEY = "outbox";
const META_KEY = "meta";
const SCHEMA_VERSION = 1;
const LOCK_NAME = "swift-todo:storage";
const RETRY_AFTER_FAILURE_MS = 60_000;
const FIRST_STRATEGY: TFlushStrategy = { promote: true, demoteNew: false, demoteAll: false };

function isOutboxEntry(value: unknown): value is TOutboxEntry {
  return isObject(value) && (value.op === "delete" || (value.op === "put" && isTodoRecord(value.record)));
}

function readOutbox(value: unknown): TOutbox {
  const outbox: TOutbox = {};

  if (isObject(value)) {
    for (const [id, entry] of Object.entries(value)) {
      if (isOutboxEntry(entry)) {
        outbox[id] = entry;
      }
    }
  }

  return outbox;
}

function byPosition([idA, a]: [string, TTodoRecord], [idB, b]: [string, TTodoRecord]): number {
  return compareTodos({ id: idA, position: a.p, createdAt: a.c }, { id: idB, position: b.p, createdAt: b.c });
}

/**
 * Stores to-dos in `browser.storage.sync`, working around its limits:
 *
 * - Every change is first saved to a queue (the outbox) in `storage.local`,
 *   so nothing is lost when the popup closes, then written to sync in batches.
 * - Writes stay under the per-minute and per-hour limits ({@link WriteBudget});
 *   when they can't, the queue waits and an alarm retries from the background.
 * - To-dos that don't fit in sync stay on the device and move to sync once
 *   space frees up. When sync is off or unsupported, everything stays local.
 */
export class SyncTodoRepository implements TTodoRepository {
  private readonly limits: TSyncLimits;
  private readonly budget: WriteBudget;
  private readonly now: () => number;
  private syncDisabled: boolean;
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private retryAt: number | null = null;

  /**
   * Creates a repository.
   *
   * @param options The storage areas and browser APIs to use.
   */
  constructor(private readonly options: TRepositoryOptions) {
    this.limits = options.limits ?? resolveSyncLimits(undefined);
    this.now = options.now ?? Date.now;
    this.budget = new WriteBudget(options.session, this.limits, this.now);
    this.syncDisabled = options.sync === undefined;
  }

  /**
   * Reads the list and the storage status.
   *
   * @returns The current snapshot.
   */
  async load(): Promise<TTodoSnapshot> {
    return this.snapshot(await this.readState());
  }

  /**
   * Adds a to-do at the end of the list.
   *
   * @param text The to-do text.
   * @returns The new to-do.
   */
  async add(text: string): Promise<TTodo> {
    const clean = normalizeText(text);

    if (clean.length === 0) {
      throw new TodoError("empty");
    }

    let added: TTodo | undefined;

    await this.mutate((state) => {
      const todos = this.view(state);

      if (todos.length >= TODO_LIMITS.maxTodos) {
        throw new TodoError("too-many");
      }

      const now = this.now();
      const id = createId();
      const record = encodeTodo({
        text: clean,
        done: false,
        position: positionAfter(todos.at(-1)?.position ?? null),
        createdAt: now,
        updatedAt: now,
      });
      const location = this.placeNew(state, [[id, record]]);

      added = decodeTodo(id, record, location, location === "sync");

      return [{ id, record, location }];
    });

    return added!;
  }

  /**
   * Changes the text or done state of a to-do.
   *
   * @param id The to-do ID.
   * @param patch The fields to change.
   * @returns Once the change is saved.
   */
  async update(id: string, patch: TTodoPatch): Promise<void> {
    await this.mutate((state) => {
      const todo = this.find(state, id);
      const text = patch.text === undefined ? todo.text : normalizeText(patch.text);
      const done = patch.done ?? todo.done;

      if (text.length === 0) {
        throw new TodoError("empty");
      }

      if (text === todo.text && done === todo.done) {
        return [];
      }

      const record = encodeTodo({ ...todo, text, done, updatedAt: this.now() });

      return [{ id, record, location: this.locationOf(state, todo) }];
    });
  }

  /**
   * Deletes a to-do.
   *
   * @param id The to-do ID.
   * @returns The removed to-do, for undo, or `null` when it didn't exist.
   */
  async remove(id: string): Promise<TTodo | null> {
    let removed: TTodo | null = null;

    await this.mutate((state) => {
      const todo = this.view(state).find(item => item.id === id);

      if (todo === undefined) {
        return [];
      }

      removed = todo;

      return [{ id, record: null, location: this.locationOf(state, todo) }];
    });

    return removed;
  }

  /**
   * Puts removed to-dos back with their IDs and positions.
   *
   * @param todos The to-dos to restore.
   * @returns Once they are saved.
   */
  async restore(todos: ReadonlyArray<TTodo>): Promise<void> {
    if (todos.length === 0) {
      return;
    }

    await this.mutate((state) => {
      const now = this.now();
      const entries = todos.map(todo => [todo.id, encodeTodo({ ...todo, updatedAt: now })] as [string, TTodoRecord]);
      const location = this.placeNew(state, entries);

      return entries.map(([id, record]) => ({ id, record, location }));
    });
  }

  /**
   * Moves a to-do within the list.
   *
   * @param id The to-do ID.
   * @param toIndex Index it should end up at in the sorted list.
   * @returns Once the new order is saved.
   */
  async move(id: string, toIndex: number): Promise<void> {
    await this.mutate((state) => {
      const todos = this.view(state);
      const moves = planMove(todos, id, toIndex);
      const now = this.now();

      return todos
        .filter(todo => moves.has(todo.id))
        .map(todo => ({
          id: todo.id,
          record: encodeTodo({ ...todo, position: moves.get(todo.id)!, updatedAt: now }),
          location: this.locationOf(state, todo),
        }));
    });
  }

  /**
   * Deletes every done to-do.
   *
   * @returns The removed to-dos, for undo.
   */
  async clearCompleted(): Promise<Array<TTodo>> {
    const removed: Array<TTodo> = [];

    await this.mutate((state) => {
      const done = this.view(state).filter(todo => todo.done);

      removed.push(...done);

      return done.map(todo => ({ id: todo.id, record: null, location: this.locationOf(state, todo) }));
    });

    return removed;
  }

  /**
   * Writes pending changes to sync now, as far as the limits allow, and
   * moves device-only to-dos to sync when there is room.
   *
   * @returns Once done, or once the next attempt is scheduled.
   */
  async flush(): Promise<void> {
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;

    await withLock(LOCK_NAME, async () => this.flushLocked(FIRST_STRATEGY));
  }

  /**
   * Follows changes to stored to-dos, from any extension context or another device.
   *
   * @param listener Called with the area that changed.
   * @returns A function that stops following.
   */
  subscribe(listener: (area: TChangedArea) => void): () => void {
    const onChanged = this.options.onChanged;

    if (onChanged === undefined) {
      return () => {};
    }

    const handler: TStorageChangeListener = (changes, area) => {
      if (area !== "sync" && area !== "local") {
        return;
      }

      if (Object.keys(changes).some(key => key === OUTBOX_KEY || idFromKey(key) !== null)) {
        listener(area);
      }
    };

    onChanged.addListener(handler);

    return () => onChanged.removeListener(handler);
  }

  // State

  private async readState(): Promise<TState> {
    let mode: TStorageMode = this.syncDisabled ? "local" : "sync";
    let sync: Record<string, unknown> = {};

    if (mode === "sync") {
      const [error, items] = await tryCatch(async () => this.options.sync!.get(null));

      if (error === null) {
        sync = items;
      }
      else if (classifyStorageError(error) === "unavailable") {
        this.syncDisabled = true;
        mode = "local";
      }
      else {
        throw error;
      }
    }

    const local = await this.options.local.get(null);

    return {
      mode,
      sync,
      syncRecords: readRecords(sync),
      deviceRecords: readRecords(local),
      outbox: readOutbox(local[OUTBOX_KEY]),
    };
  }

  // The to-dos as the user sees them: device and sync records, with pending changes applied.
  private view(state: TState): Array<TTodo> {
    const todos = new Map<string, TTodo>();

    for (const [id, record] of state.deviceRecords) {
      todos.set(id, decodeTodo(id, record, "device"));
    }

    // A to-do in both areas is mid-move between them; the newer copy wins.
    // A pending delete removes the sync copy only; a device copy stays.
    for (const [id, record] of state.syncRecords) {
      const device = todos.get(id);

      if (state.outbox[id]?.op === "delete") {
        continue;
      }

      if (device === undefined || device.updatedAt <= record.u) {
        todos.set(id, decodeTodo(id, record, "sync"));
      }
    }

    for (const [id, entry] of Object.entries(state.outbox)) {
      if (entry.op === "put") {
        todos.set(id, decodeTodo(id, entry.record, "sync", true));
      }
    }

    return [...todos.values()].sort(compareTodos);
  }

  private snapshot(state: TState): TTodoSnapshot {
    const todos = this.view(state);

    return {
      todos,
      status: {
        mode: state.mode,
        pending: Object.keys(state.outbox).length,
        deviceOnly: todos.filter(todo => todo.location === "device").length,
        usage: this.usage(state),
        retryAt: this.retryAt,
      },
    };
  }

  // Sync usage once every pending change is written.
  private usage(state: TState): TStorageUsage {
    let bytes = areaBytes(state.sync);
    let items = Object.keys(state.sync).length;

    for (const [id, entry] of Object.entries(state.outbox)) {
      const key = todoKey(id);
      const existing = key in state.sync ? itemBytes(key, state.sync[key]) : 0;

      if (entry.op === "delete") {
        bytes -= existing;
        items -= existing > 0 ? 1 : 0;
      }
      else {
        bytes += itemBytes(key, entry.record) - existing;
        items += existing > 0 ? 0 : 1;
      }
    }

    const { quotaBytes, maxItems } = this.limits;

    return {
      bytes,
      quotaBytes,
      items,
      maxItems,
      ratio: Math.min(1, Math.max(bytes / quotaBytes, items / maxItems)),
    };
  }

  private find(state: TState, id: string): TTodo {
    const todo = this.view(state).find(item => item.id === id);

    if (todo === undefined) {
      throw new TodoError("not-found");
    }

    return todo;
  }

  private locationOf(state: TState, todo: TTodo): TTodoLocation {
    return state.mode === "local" ? "device" : todo.location;
  }

  // Sync when the new to-dos fit within the safety margin, otherwise the device.
  private placeNew(state: TState, entries: ReadonlyArray<[string, TTodoRecord]>): TTodoLocation {
    if (state.mode === "local") {
      return "device";
    }

    const usage = this.usage(state);
    let bytes = usage.bytes;
    let items = usage.items;

    for (const [id, record] of entries) {
      const size = itemBytes(todoKey(id), record);

      if (size > this.limits.quotaBytesPerItem) {
        return "device";
      }

      bytes += size;
      items += 1;
    }

    const fits = bytes <= this.limits.quotaBytes * SAFETY.quotaRatio
      && items <= this.limits.maxItems - SAFETY.reservedItems;

    return fits ? "sync" : "device";
  }

  // Writes

  // Applies changes inside the storage lock, then schedules a flush.
  private async mutate(plan: (state: TState) => Array<TChange>): Promise<void> {
    let changed = false;

    await withLock(LOCK_NAME, async () => {
      const state = await this.readState();
      const changes = plan(state);

      if (changes.length === 0) {
        return;
      }

      const outbox = { ...state.outbox };
      const localSet: Record<string, unknown> = {};
      const localRemove: Array<string> = [];

      for (const { id, record, location } of changes) {
        const key = todoKey(id);
        const inSync = state.syncRecords.has(id);

        if (record === null && state.deviceRecords.has(id)) {
          localRemove.push(key);
        }

        if (record !== null && location === "sync") {
          outbox[id] = { op: "put", record };
          continue;
        }

        if (record !== null) {
          localSet[key] = record;
        }

        // The sync copy, if any, has to go; otherwise there is nothing left to send.
        if (inSync) {
          outbox[id] = { op: "delete" };
        }
        else {
          delete outbox[id];
        }
      }

      await this.options.local.set({ ...localSet, [OUTBOX_KEY]: outbox });

      if (localRemove.length > 0) {
        await this.options.local.remove(localRemove);
      }

      changed = true;
    });

    if (changed) {
      this.scheduleFlush();
    }
  }

  private scheduleFlush(): void {
    clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flushInBackground(), FLUSH_DEBOUNCE_MS);

    // Covers the popup closing before the timer fires.
    void tryCatch(async () => this.options.alarms?.create(FLUSH_ALARM, { delayInMinutes: FLUSH_ALARM_DELAY_MINUTES }));
  }

  private scheduleRetry(delayMs: number): void {
    this.retryAt = this.now() + delayMs;

    clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flushInBackground(), delayMs);

    void tryCatch(async () => this.options.alarms?.create(FLUSH_ALARM, {
      delayInMinutes: Math.max(FLUSH_ALARM_DELAY_MINUTES, delayMs / 60_000),
    }));
  }

  private flushInBackground(): void {
    this.flush().catch((error: unknown) => console.error("[swift-todo] Could not write pending changes.", error));
  }

  private async flushLocked(strategy: TFlushStrategy): Promise<void> {
    const state = await this.readState();

    if (state.mode === "local") {
      await this.settleLocally(state);

      return;
    }

    const plan = this.planFlush(state, strategy);
    const hasSet = Object.keys(plan.toSet).length > 0;
    const hasRemove = plan.toRemove.length > 0;
    const ops = (hasSet ? 1 : 0) + (hasRemove ? 1 : 0);

    if (ops > 0) {
      const wait = await this.budget.reserve(ops);

      if (wait > 0) {
        this.scheduleRetry(wait);

        return;
      }
    }

    // Save demoted to-dos on the device before removing them from sync.
    if (plan.demoted.size > 0) {
      await this.options.local.set(Object.fromEntries([...plan.demoted].map(([id, record]) => [todoKey(id), record])));
    }

    if (hasSet) {
      const [error] = await tryCatch(async () => this.options.sync!.set(plan.toSet));

      if (error !== null) {
        await this.recover(error, strategy);

        return;
      }
    }

    if (hasRemove) {
      const [error] = await tryCatch(async () => this.options.sync!.remove(plan.toRemove));

      if (error !== null) {
        await this.recover(error, strategy);

        return;
      }
    }

    const outbox = { ...state.outbox };

    for (const id of plan.settled) {
      delete outbox[id];
    }

    await this.options.local.set({ [OUTBOX_KEY]: outbox });

    if (plan.localRemove.length > 0) {
      await this.options.local.remove(plan.localRemove);
    }

    this.retryAt = null;

    if (Object.keys(outbox).length === 0) {
      void tryCatch(async () => this.options.alarms?.clear(FLUSH_ALARM));
    }
  }

  // Decides what to write to sync, what to keep on the device, and what to clean up.
  private planFlush(state: TState, strategy: TFlushStrategy): TFlushPlan {
    const plan: TFlushPlan = { toSet: {}, toRemove: [], demoted: new Map(), settled: [], localRemove: [] };
    const maxBytes = this.limits.quotaBytes * SAFETY.quotaRatio;
    const promoteBytes = this.limits.quotaBytes * SAFETY.promoteRatio;
    const maxItems = this.limits.maxItems - SAFETY.reservedItems;
    let bytes = areaBytes(state.sync);
    let items = Object.keys(state.sync).length;

    const meta = state.sync[META_KEY];

    if (!isObject(meta) || meta.v !== SCHEMA_VERSION) {
      const value = { v: SCHEMA_VERSION };

      plan.toSet[META_KEY] = value;
      bytes += itemBytes(META_KEY, value) - (meta === undefined ? 0 : itemBytes(META_KEY, meta));
      items += meta === undefined ? 1 : 0;
    }

    const entries = Object.entries(state.outbox);

    // Deletions first, so they free space for the rest.
    for (const [id, entry] of entries) {
      if (entry.op === "delete") {
        const key = todoKey(id);

        if (key in state.sync) {
          plan.toRemove.push(key);
          bytes -= itemBytes(key, state.sync[key]);
          items -= 1;
        }

        plan.settled.push(id);
      }
    }

    const puts = entries
      .flatMap(([id, entry]) => entry.op === "put" ? [[id, entry.record] as [string, TTodoRecord]] : [])
      .sort(byPosition);

    for (const [id, record] of puts) {
      const key = todoKey(id);
      const inSync = key in state.sync;
      const previous = inSync ? itemBytes(key, state.sync[key]) : 0;
      const size = itemBytes(key, record);
      const fits = size <= this.limits.quotaBytesPerItem
        && bytes - previous + size <= maxBytes
        && (inSync || items + 1 <= maxItems);

      if (strategy.demoteAll || (strategy.demoteNew && !inSync) || !fits) {
        plan.demoted.set(id, record);

        if (inSync) {
          plan.toRemove.push(key);
          bytes -= previous;
          items -= 1;
        }
      }
      else {
        plan.toSet[key] = record;
        bytes += size - previous;
        items += inSync ? 0 : 1;
      }

      plan.settled.push(id);
    }

    for (const [id, record] of [...state.deviceRecords].sort(byPosition)) {
      const key = todoKey(id);
      const synced = state.syncRecords.get(id);

      if (id in state.outbox || plan.demoted.has(id)) {
        continue;
      }

      // Left over from an interrupted move between areas: keep the newer copy.
      if (synced !== undefined) {
        if (record.u > synced.u) {
          plan.toRemove.push(key);
        }
        else {
          plan.localRemove.push(key);
        }

        continue;
      }

      const size = itemBytes(key, record);

      if (strategy.promote && bytes + size <= promoteBytes && items + 1 <= maxItems) {
        plan.toSet[key] = record;
        plan.localRemove.push(key);
        bytes += size;
        items += 1;
      }
    }

    return plan;
  }

  // Handles a failed sync write: wait, fall back to the device, or stop using sync.
  private async recover(error: unknown, strategy: TFlushStrategy): Promise<void> {
    const failure = classifyStorageError(error);

    if (failure === "unavailable") {
      this.syncDisabled = true;
      await this.settleLocally(await this.readState());

      return;
    }

    if (failure === "quota" && !strategy.demoteAll) {
      // Sync filled up behind our back (another device): retry, keeping new to-dos local,
      // then everything local if that still doesn't fit.
      await this.flushLocked({ promote: false, demoteNew: true, demoteAll: strategy.demoteNew });

      return;
    }

    console.warn("[swift-todo] Sync write failed, retrying later.", error);
    this.scheduleRetry(RETRY_AFTER_FAILURE_MS);
  }

  // Without sync, pending to-dos move to the device. Deletions wait for sync to come back.
  private async settleLocally(state: TState): Promise<void> {
    const outbox: TOutbox = {};
    const localSet: Record<string, unknown> = {};

    for (const [id, entry] of Object.entries(state.outbox)) {
      if (entry.op === "put") {
        localSet[todoKey(id)] = entry.record;
      }
      else {
        outbox[id] = entry;
      }
    }

    await this.options.local.set({ ...localSet, [OUTBOX_KEY]: outbox });
  }
}

/**
 * Creates the repository wired to the real browser APIs.
 *
 * @returns The repository.
 */
export function createTodoRepository(): SyncTodoRepository {
  const sync = browser.storage.sync as unknown as (TStorageArea & TSyncQuotaConstants) | undefined;

  return new SyncTodoRepository({
    sync,
    local: browser.storage.local as unknown as TStorageArea,
    session: browser.storage.session as unknown as TBudgetArea,
    alarms: browser.alarms,
    onChanged: browser.storage.onChanged as unknown as TRepositoryOptions["onChanged"],
    limits: resolveSyncLimits(sync),
  });
}
