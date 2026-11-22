import type { TPrefs } from "../prefs/prefs";
import type { TSyncLimits, TSyncQuotaConstants } from "./limits";
import type { TList } from "./lists";
import type { TDocKey } from "./merge-docs";
import type { TTodo, TTodoFields, TTodoLocation, TTodoRecord, TTrashRecord } from "./model";
import type { TChangedArea, TImportData, TImportMode, TImportResult, TStorageMode, TStorageUsage, TTodoPatch, TTodoRepository, TTodoSnapshot } from "./repository";
import type { TBudgetArea } from "./write-budget";

import { isObject, tryCatch } from "@eoussama/core";
import { browser } from "wxt/browser";

import { mergePrefs, parsePrefs } from "../prefs/prefs";
import { isOneOf, same } from "../values";
import { classifyStorageError, TodoError } from "./errors";
import { FLUSH_ALARM, FLUSH_ALARM_DELAY_MINUTES, FLUSH_DEBOUNCE_MS, resolveSyncLimits, SAFETY, TRASH_RETENTION_MS } from "./limits";
import { encodeLists, MAX_LISTS, parseLists } from "./lists";
import { withLock } from "./lock";
import { DOC_KEYS, mergeDoc } from "./merge-docs";
import { compareTodos, createId, decodeTodo, decodeTrashed, EMPTY_FIELDS, encodeTodo, idFromKey, idFromTrashKey, isTodoRecord, normalizeText, readRecords, readTrash, sanitizeSource, todoKey, trashKey } from "./model";
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
  /** The extension always has the `alarms` permission. */
  alarms: {
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

/**
 * A queued change. A delete notes the version it removes (`u`), so an edit
 * made since on another device isn't wiped out with it.
 */
type TOutboxEntry = { op: "put"; record: TTodoRecord } | { op: "delete"; u?: number } | { op: "doc"; value: unknown; base?: unknown };
type TOutbox = Record<string, TOutboxEntry>;

type TState = {
  mode: TStorageMode;
  /** Raw dump of the sync area. */
  sync: Record<string, unknown>;
  syncRecords: Map<string, TTodoRecord>;
  deviceRecords: Map<string, TTodoRecord>;
  trashRecords: Map<string, TTrashRecord>;
  outbox: TOutbox;
  /** Current value of each document: pending, else synced, else the device copy. */
  docs: Record<TDocKey, unknown>;
};

/** What a write changes: to-dos, and optionally documents. */
type TMutation = {
  changes?: Array<TChange>;
  docs?: Partial<Record<TDocKey, unknown>>;
};

type TChange = {
  id: string;
  record: TTodoRecord | null;
  location: TTodoLocation;
  /** On removal: the copy to keep in the trash. */
  trashed?: TTrashRecord;
};

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
  /** Device keys to delete once sync has been written. */
  localRemove: Array<string>;
};

const OUTBOX_KEY = "outbox";

/**
 * The time to stamp on an edit: now, but never earlier than the version it
 * replaces. Another device's clock may run ahead of this one's; without this,
 * an edit made here would look older than the one it changes and lose to it.
 *
 * @param previous The edited version's `updatedAt`.
 * @param now This device's clock.
 * @returns The new `updatedAt`.
 */
export function stampAfter(previous: number, now: number): number {
  return Math.max(now, previous + 1);
}

// What a key takes up in sync now, or nothing when it isn't there.
function syncedBytes(state: TState, key: string): number {
  return key in state.sync ? itemBytes(key, state.sync[key]) : 0;
}

/**
 * Whether a queued change was overtaken: the copy in sync is newer, because
 * another device edited the to-do after this one queued its change.
 *
 * @param queued The queued record.
 * @param synced The record in sync, if any.
 * @returns Whether the queued one should give way.
 */
function isStale(queued: TTodoRecord, synced: TTodoRecord | undefined): boolean {
  return synced !== undefined && synced.u > queued.u;
}

// A queued delete that another device's later edit overtook: the edit stays.
// A delete queued before deletes noted their version (no `u`) is never overtaken.
function deleteOvertaken(entry: { u?: number }, synced: TTodoRecord | undefined): boolean {
  return synced !== undefined && synced.u > (entry.u ?? Number.POSITIVE_INFINITY);
}
const META_KEY = "meta";
/** 2 adds optional to-do fields (list, due, repeat, source, today) and the lists and prefs documents. */
const SCHEMA_VERSION = 2;
const LOCK_NAME = "swift-todo:storage";
const RETRY_AFTER_FAILURE_MS = 60_000;
const FIRST_STRATEGY: TFlushStrategy = { promote: true, demoteNew: false, demoteAll: false };
const DOC_PREFIX = "@";

function isOutboxEntry(key: string, value: unknown): value is TOutboxEntry {
  if (!isObject(value)) {
    return false;
  }

  if (key.startsWith(DOC_PREFIX)) {
    return value.op === "doc" && "value" in value && isOneOf(DOC_KEYS, key.slice(DOC_PREFIX.length));
  }

  return (value.op === "delete" && (value.u === undefined || Number.isFinite(value.u))) || (value.op === "put" && isTodoRecord(value.record));
}

function readOutbox(value: unknown): TOutbox {
  const outbox: TOutbox = {};

  if (isObject(value)) {
    for (const [id, entry] of Object.entries(value)) {
      if (isOutboxEntry(id, entry)) {
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
   * @param fields Optional details: list, due, repeat, source, today.
   * @returns The new to-do.
   */
  async add(text: string, fields: Partial<TTodoFields> = {}): Promise<TTodo> {
    const [added] = await this.addMany([{ text, fields }]);

    return added!;
  }

  /**
   * Adds several to-dos at the end of the list, in order, as one change.
   *
   * @param items The texts and optional details.
   * @returns The new to-dos.
   * @throws {TodoError} `empty` when any text is blank.
   */
  async addMany(items: ReadonlyArray<{ text: string; fields?: Partial<TTodoFields> }>): Promise<Array<TTodo>> {
    const clean = items.map(item => ({ text: normalizeText(item.text), fields: item.fields ?? {} }));

    if (clean.length === 0 || clean.some(item => item.text.length === 0)) {
      throw new TodoError("empty");
    }

    const added: Array<TTodo> = [];

    await this.mutate((state) => {
      const now = this.now();
      let last = this.view(state).at(-1)?.position ?? null;

      const entries = clean.map(({ text, fields }): [string, TTodoRecord] => {
        last = positionAfter(last);

        return [createId(), encodeTodo({ ...EMPTY_FIELDS, ...fields, text, done: false, position: last, createdAt: now, updatedAt: now })];
      });
      const location = this.placeNew(state, entries);

      added.push(...entries.map(([id, record]) => decodeTodo(id, record, location, location === "sync")));

      return entries.map(([id, record]) => ({ id, record, location }));
    });

    return added;
  }

  /**
   * Changes a to-do: its text, done state, list, due date, repeat rule or Today pin.
   *
   * @param id The to-do ID.
   * @param patch The fields to change; `null` clears an optional field.
   * @returns Once the change is saved.
   */
  async update(id: string, patch: TTodoPatch): Promise<void> {
    await this.mutate((state) => {
      const todo = this.find(state, id);
      const text = patch.text === undefined ? todo.text : normalizeText(patch.text);

      if (text.length === 0) {
        throw new TodoError("empty");
      }

      const next: TTodo = {
        ...todo,
        text,
        done: patch.done ?? todo.done,
        list: patch.list === undefined ? todo.list : patch.list,
        due: patch.due === undefined ? todo.due : patch.due,
        repeat: patch.repeat === undefined ? todo.repeat : patch.repeat,
        today: patch.today === undefined ? todo.today : patch.today,
        position: patch.position ?? todo.position,
        history: patch.history ?? todo.history,
        hidden: patch.hidden ?? todo.hidden,
        pinned: patch.pinned ?? todo.pinned,
        // A link set by hand goes through the same checks as one from a page.
        source: patch.source === undefined ? todo.source : patch.source === null ? null : sanitizeSource(patch.source.url, patch.source.title),
      };

      // Nothing to write when the stored record would be the same.
      if (same(encodeTodo({ ...next, updatedAt: todo.updatedAt }), encodeTodo(todo))) {
        return [];
      }

      return [{ id, record: encodeTodo({ ...next, updatedAt: stampAfter(todo.updatedAt, this.now()) }), location: this.locationOf(state, todo) }];
    });
  }

  /**
   * Moves a to-do to the trash, which lives on this device only.
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

      return [this.trashChange(state, todo)];
    });

    return removed;
  }

  /**
   * Puts removed or trashed to-dos back with their IDs and positions, and
   * takes them out of the trash.
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

      return this.placeTodos(state, todos, todo => stampAfter(todo.updatedAt, now));
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
          record: encodeTodo({ ...todo, position: moves.get(todo.id)!, updatedAt: stampAfter(todo.updatedAt, now) }),
          location: this.locationOf(state, todo),
        }));
    });
  }

  /**
   * Chooses whether a to-do is synced. Turning sync off keeps it on the device
   * and frees its sync space; automatic moves leave it there. Turning sync on
   * moves it to sync when it fits.
   *
   * @param id The to-do ID.
   * @param synced Whether the to-do should be synced.
   * @returns Once the choice is saved.
   * @throws {TodoError} `sync-unavailable` when sync is off, `sync-full` when the to-do doesn't fit.
   */
  async setSynced(id: string, synced: boolean): Promise<void> {
    await this.mutate((state) => {
      const todo = this.find(state, id);

      if (synced && state.mode === "local") {
        throw new TodoError("sync-unavailable");
      }

      if (synced ? todo.location === "sync" : todo.keepOnDevice) {
        return [];
      }

      const record = encodeTodo({ ...todo, keepOnDevice: !synced, updatedAt: stampAfter(todo.updatedAt, this.now()) });

      if (!synced) {
        // Stryker disable next-line StringLiteral: a change's location is only ever compared with "sync".
        return [{ id, record, location: "device" }];
      }

      if (this.placeNew(state, [[id, record]]) !== "sync") {
        throw new TodoError("sync-full");
      }

      return [{ id, record, location: "sync" }];
    });
  }

  /**
   * Moves done to-dos to the trash: every one, or only those given.
   *
   * @param ids Limits the clearing to these to-dos, for example the current list's.
   * @returns The removed to-dos, for undo.
   */
  async clearCompleted(ids?: ReadonlyArray<string>): Promise<Array<TTodo>> {
    const removed: Array<TTodo> = [];
    const only = ids === undefined ? null : new Set(ids);

    await this.mutate((state) => {
      const done = this.view(state).filter(todo => todo.done && (only === null || only.has(todo.id)));

      removed.push(...done);

      return done.map(todo => this.trashChange(state, todo));
    });

    return removed;
  }

  /**
   * Replaces the user lists: create, rename and reorder.
   *
   * @param lists The lists, in order. At most {@link MAX_LISTS} are kept.
   * @returns Once saved.
   */
  async saveLists(lists: ReadonlyArray<TList>): Promise<void> {
    // Parsing drops malformed and duplicate lists, and keeps at most MAX_LISTS.
    await this.mutate(() => ({ docs: { lists: encodeLists(parseLists(encodeLists(lists))) } }));
  }

  /**
   * Deletes a list. Its to-dos move to the Inbox rather than being deleted.
   *
   * @param id The list ID.
   * @returns Once saved.
   */
  async deleteList(id: string): Promise<void> {
    await this.mutate((state) => {
      const lists = parseLists(state.docs.lists).filter(list => list.id !== id);
      const now = this.now();
      const changes = this.view(state)
        .filter(todo => todo.list === id)
        .map(todo => ({ id: todo.id, record: encodeTodo({ ...todo, list: null, updatedAt: stampAfter(todo.updatedAt, now) }), location: this.locationOf(state, todo) }));

      return { changes, docs: { lists: encodeLists(lists) } };
    });
  }

  /**
   * Changes some settings, keeping any this version doesn't know.
   *
   * @param patch The settings to change.
   * @returns Once saved.
   */
  async savePrefs(patch: Partial<TPrefs>): Promise<void> {
    await this.mutate(state => ({ docs: { prefs: mergePrefs(state.docs.prefs, patch) } }));
  }

  /**
   * Imports a backup. Merging adds the to-dos and lists that aren't here yet;
   * replacing moves the current to-dos to the trash (so they can be restored)
   * and takes the backup's lists and settings.
   *
   * @param data The validated backup.
   * @param mode Merge with or replace the current to-dos.
   * @returns What was added, skipped and trashed.
   */
  async importData(data: TImportData, mode: TImportMode): Promise<TImportResult> {
    const result: TImportResult = { added: 0, skipped: 0, trashed: 0 };

    await this.mutate((state) => {
      const current = this.view(state);
      const existing = new Set(current.map(todo => todo.id));
      const changes: Array<TChange> = [];

      // Merging, one in the list already is skipped, and one in the trash is added under a new ID,
      // so the trashed one stays restorable. Replacing, a backup copy of a to-do now in the trash
      // gets a new ID, so the trash and the list never hold the same ID, and its writes can't clash.
      const incoming = mode === "replace"
        ? data.todos.map(todo => (existing.has(todo.id) || state.trashRecords.has(todo.id) ? { ...todo, id: createId() } : todo))
        : data.todos
            .filter(todo => !existing.has(todo.id))
            .map(todo => (state.trashRecords.has(todo.id) ? { ...todo, id: createId() } : todo));

      if (mode === "replace") {
        changes.push(...current.map(todo => this.trashChange(state, todo)));
        result.trashed = current.length;
      }

      const now = this.now();

      changes.push(...this.placeTodos(state, incoming, () => now));

      result.added = incoming.length;
      result.skipped = data.todos.length - incoming.length;

      const currentLists = parseLists(state.docs.lists);
      const lists = mode === "replace"
        ? [...data.lists]
        : [...currentLists, ...data.lists.filter(list => !currentLists.some(own => own.id === list.id))];

      const docs: TMutation["docs"] = { lists: encodeLists(lists.slice(0, MAX_LISTS)) };

      if (mode === "replace" && data.prefs !== null) {
        docs.prefs = mergePrefs(state.docs.prefs, data.prefs);
      }

      return { changes, docs };
    });

    return result;
  }

  /**
   * Deletes a trashed to-do for good.
   *
   * @param id The to-do ID.
   * @returns Once it is gone.
   */
  async deleteForever(id: string): Promise<void> {
    await withLock(LOCK_NAME, async () => this.options.local.remove(trashKey(id)));
  }

  /**
   * Deletes every trashed to-do for good.
   *
   * @returns How many were deleted.
   */
  async emptyTrash(): Promise<number> {
    return withLock(LOCK_NAME, async () => {
      const keys = [...readTrash(await this.options.local.get(null)).keys()].map(trashKey);

      if (keys.length > 0) {
        await this.options.local.remove(keys);
      }

      return keys.length;
    });
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

    await withLock(LOCK_NAME, async () => {
      await this.purgeTrash();
      await this.flushLocked(FIRST_STRATEGY);
    });
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

      const relevant = (key: string): boolean => key === OUTBOX_KEY || idFromKey(key) !== null || idFromTrashKey(key) !== null
        || isOneOf(DOC_KEYS, key);

      if (Object.keys(changes).some(relevant)) {
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
    const outbox = readOutbox(local[OUTBOX_KEY]);
    const docs = {} as Record<TDocKey, unknown>;

    for (const key of DOC_KEYS) {
      const pending = outbox[`${DOC_PREFIX}${key}`];

      // A pending change shows merged with whatever another device has synced since.
      docs[key] = pending?.op === "doc" ? mergeDoc(key, pending.value, pending.base, sync[key]) : (key in sync ? sync[key] : local[key]);
    }

    return {
      mode,
      sync,
      syncRecords: readRecords(sync),
      deviceRecords: readRecords(local),
      trashRecords: readTrash(local),
      outbox,
      docs,
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

      const pending = state.outbox[id];

      if (pending?.op === "delete" && !deleteOvertaken(pending, record)) {
        continue;
      }

      if (device === undefined || device.updatedAt <= record.u) {
        todos.set(id, decodeTodo(id, record, "sync"));
      }
    }

    for (const [id, entry] of Object.entries(state.outbox)) {
      if (entry.op === "put" && !isStale(entry.record, state.syncRecords.get(id))) {
        todos.set(id, decodeTodo(id, entry.record, "sync", true));
      }
    }

    return [...todos.values()].sort(compareTodos);
  }

  private snapshot(state: TState): TTodoSnapshot {
    const todos = this.view(state);
    const live = new Set(todos.map(todo => todo.id));

    return {
      todos,
      // A to-do edited on another device after it was trashed here is back in the list, so it leaves the trash.
      trash: [...state.trashRecords].filter(([id]) => !live.has(id)).map(([id, record]) => decodeTrashed(id, record)).sort((a, b) => b.deletedAt - a.deletedAt),
      lists: parseLists(state.docs.lists),
      prefs: parsePrefs(state.docs.prefs),
      status: {
        mode: state.mode,
        pending: Object.keys(state.outbox).length,
        synced: todos.filter(todo => todo.location === "sync").length,
        deviceOnly: todos.filter(todo => todo.location === "device").length,
        keptOnDevice: todos.filter(todo => todo.keepOnDevice).length,
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
      const key = entry.op === "doc" ? id.slice(DOC_PREFIX.length) : todoKey(id);
      const existing = syncedBytes(state, key);

      if (entry.op === "delete") {
        bytes -= existing;
        items -= existing > 0 ? 1 : 0;
      }
      else {
        bytes += itemBytes(key, entry.op === "doc" ? entry.value : entry.record) - existing;
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

  // Removes a to-do from the list and keeps a copy in the trash.
  private trashChange(state: TState, todo: TTodo): TChange {
    return {
      id: todo.id,
      record: null,
      location: this.locationOf(state, todo),
      trashed: { ...encodeTodo(todo), x: this.now() },
    };
  }

  // Deletes trashed to-dos older than the retention period. Runs inside the storage lock.
  private async purgeTrash(): Promise<void> {
    const cutoff = this.now() - TRASH_RETENTION_MS;
    const expired = [...readTrash(await this.options.local.get(null))]
      .filter(([, record]) => record.x < cutoff)
      .map(([id]) => trashKey(id));

    if (expired.length > 0) {
      await this.options.local.remove(expired);
    }
  }

  private locationOf(state: TState, todo: TTodo): TTodoLocation {
    if (state.mode === "local") {
      // Stryker disable next-line StringLiteral: a change's location is only ever compared with "sync".
      return "device";
    }

    return todo.location;
  }

  // To-dos the user kept on the device go there; the rest go to sync if they fit.
  private placeTodos(state: TState, todos: ReadonlyArray<TTodo>, stamp: (todo: TTodo) => number): Array<TChange> {
    const encode = (todo: TTodo): [string, TTodoRecord] => [todo.id, encodeTodo({ ...todo, updatedAt: stamp(todo) })];
    const kept = todos.filter(todo => todo.keepOnDevice).map(encode);
    const others = todos.filter(todo => !todo.keepOnDevice).map(encode);
    const location = this.placeNew(state, others);

    return [
      ...kept.map(([id, record]) => ({ id, record, location: "device" as const })),
      ...others.map(([id, record]) => ({ id, record, location })),
    ];
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
  private async mutate(plan: (state: TState) => Array<TChange> | TMutation): Promise<void> {
    let changed = false;

    await withLock(LOCK_NAME, async () => {
      const state = await this.readState();
      const planned = plan(state);
      const { changes = [], docs = {} } = Array.isArray(planned) ? { changes: planned } : planned;
      const docEntries = Object.entries(docs) as Array<[TDocKey, unknown]>;

      if (changes.length === 0 && docEntries.length === 0) {
        return;
      }

      const outbox = { ...state.outbox };
      const localSet: Record<string, unknown> = {};
      const localRemove: Array<string> = [];

      // Documents: queued for sync, or straight to the device when sync is off.
      for (const [key, value] of docEntries) {
        // Queued either way: with sync off, a device copy too, and the queue
        // carries it to sync once sync is back, over the older copy there.
        if (state.mode === "local") {
          localSet[key] = value;
        }

        // The synced value this change is relative to (null when sync had none), to merge against at
        // flush time. A change on top of a pending one was made to the view that already merged in
        // what sync holds now, so that's its base. Saved while sync is off, it isn't known.
        const previous = state.outbox[`${DOC_PREFIX}${key}`];
        const unknown = state.mode === "local" || (previous?.op === "doc" && previous.base === undefined);
        const base = unknown ? undefined : state.sync[key] ?? null;

        outbox[`${DOC_PREFIX}${key}`] = { op: "doc", value, base };
      }

      for (const { id, record, location, trashed } of changes) {
        const key = todoKey(id);
        const inSync = state.syncRecords.has(id);

        if (trashed !== undefined) {
          localSet[trashKey(id)] = trashed;
        }

        // Restored from the trash.
        if (record !== null && state.trashRecords.has(id)) {
          localRemove.push(trashKey(id));
        }

        if (record === null && state.deviceRecords.has(id)) {
          localRemove.push(key);
        }

        if (record !== null && location === "sync") {
          outbox[id] = { op: "put", record };

          // Moving from the device to sync: the queued put now holds the to-do.
          if (state.deviceRecords.has(id)) {
            localRemove.push(key);
          }

          continue;
        }

        if (record !== null) {
          localSet[key] = record;
        }

        // The sync copy, if any, has to go; otherwise there is nothing left to send.
        if (inSync) {
          const pending = state.outbox[id];

          // The version on screen: the queued edit or the sync copy, whichever is newer.
          outbox[id] = { op: "delete", u: Math.max(pending?.op === "put" ? pending.record.u : 0, state.syncRecords.get(id)!.u) };
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
    void tryCatch(async () => this.options.alarms.create(FLUSH_ALARM, { delayInMinutes: FLUSH_ALARM_DELAY_MINUTES }));
  }

  private scheduleRetry(delayMs: number): void {
    this.retryAt = this.now() + delayMs;

    clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flushInBackground(), delayMs);

    void tryCatch(async () => this.options.alarms.create(FLUSH_ALARM, {
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

    const wait = await this.budget.reserve(ops);

    if (wait > 0) {
      this.scheduleRetry(wait);

      return;
    }

    // Save demoted to-dos on the device before removing them from sync.
    if (plan.demoted.size > 0) {
      await this.options.local.set(Object.fromEntries([...plan.demoted].map(([id, record]) => [todoKey(id), record])));
    }

    // Removals first: the plan counts the room they free, so writing first could
    // fail on the quota for nothing. (Demoted to-dos are already saved above.)
    if (hasRemove) {
      const [error] = await tryCatch(async () => this.options.sync!.remove(plan.toRemove));

      if (error !== null) {
        await this.recover(error, strategy);

        return;
      }
    }

    if (hasSet) {
      const [error] = await tryCatch(async () => this.options.sync!.set(plan.toSet));

      if (error !== null) {
        await this.recover(error, strategy);

        return;
      }
    }

    // The plan takes care of every queued entry, so the outbox is now empty. (Already empty, it isn't
    // written again: every write would wake listeners, like the background, for nothing.)
    if (Object.keys(state.outbox).length > 0) {
      await this.options.local.set({ [OUTBOX_KEY]: {} });
    }

    if (plan.localRemove.length > 0) {
      await this.options.local.remove(plan.localRemove);
    }

    this.retryAt = null;
    void tryCatch(async () => this.options.alarms.clear(FLUSH_ALARM));
  }

  // Decides what to write to sync, what to keep on the device, and what to clean up.
  private planFlush(state: TState, strategy: TFlushStrategy): TFlushPlan {
    const plan: TFlushPlan = { toSet: {}, toRemove: [], demoted: new Map(), localRemove: [] };
    const maxBytes = this.limits.quotaBytes * SAFETY.quotaRatio;
    const promoteBytes = this.limits.quotaBytes * SAFETY.promoteRatio;
    const maxItems = this.limits.maxItems - SAFETY.reservedItems;
    let bytes = areaBytes(state.sync);
    let items = Object.keys(state.sync).length;

    const meta = state.sync[META_KEY];

    // Written once; never over another version's number, or 2.0 devices
    // (which rewrite anything but 1) and this one would take turns forever.
    if (!isObject(meta) || typeof meta.v !== "number") {
      const value = { v: SCHEMA_VERSION };

      plan.toSet[META_KEY] = value;
      bytes += itemBytes(META_KEY, value) - (meta === undefined ? 0 : itemBytes(META_KEY, meta));
      items += meta === undefined ? 1 : 0;
    }

    const entries = Object.entries(state.outbox);

    // Documents are tiny and always go to sync, ahead of to-dos.
    for (const [id, entry] of entries) {
      if (entry.op === "doc") {
        const key = id.slice(DOC_PREFIX.length);
        const previous = syncedBytes(state, key);

        const value = mergeDoc(key as TDocKey, entry.value, entry.base, state.sync[key]);

        plan.toSet[key] = value;
        bytes += itemBytes(key, value) - previous;
        items += previous > 0 ? 0 : 1;
      }
    }

    // Deletions first, so they free space for the rest.
    for (const [id, entry] of entries) {
      if (entry.op === "delete") {
        const key = todoKey(id);

        if (key in state.sync && !deleteOvertaken(entry, state.syncRecords.get(id))) {
          plan.toRemove.push(key);
          bytes -= itemBytes(key, state.sync[key]);
          items -= 1;
        }
      }
    }

    // A queued change older than the sync copy was overtaken on another device; the newer one stays.
    const puts = entries
      .flatMap(([id, entry]) => entry.op === "put" && !isStale(entry.record, state.syncRecords.get(id)) ? [[id, entry.record] as [string, TTodoRecord]] : [])
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

      // The user chose to keep this one on the device.
      if (record.k === 1) {
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
        // Deletions and settings wait in the queue for sync to come back.
        if (entry.op === "doc") {
          localSet[id.slice(DOC_PREFIX.length)] = entry.value;
        }

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
