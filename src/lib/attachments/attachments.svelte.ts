import type { TAttachment, TRefusal } from "./attachments";

import { tryCatch } from "@eoussama/core";

import { attachmentName, AttachmentRepository, createAttachmentId, planAttach } from "./attachments";



/** A file to attach: a `File`, or anything shaped like one. */
export type TFileLike = Pick<File, "name" | "type" | "size" | "arrayBuffer">;

/**
 * The attachments on this device, for the UI. Changes go to IndexedDB and
 * show here right away.
 */
export class AttachmentStore {
  items = $state<Array<TAttachment>>([]);
  /** Loaded: until then, nothing is known to be missing, so nothing is cleaned up. */
  ready = $state(false);

  /** Attachments by to-do, oldest first. */
  readonly byTodo = $derived(Object.groupBy(this.items, item => item.todo));

  /**
   * Creates a store.
   *
   * @param repository Where the attachments are kept.
   * @param now Clock, replaceable in tests.
   */
  // A moment passed along, not reactive state.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  constructor(private readonly repository: AttachmentRepository, private readonly now: () => Date = () => new Date()) {}

  /**
   * Loads the attachments. Without IndexedDB (it can be turned off), there are none.
   *
   * @returns Once loaded.
   */
  async start(): Promise<void> {
    const [error, items] = await tryCatch(async () => this.repository.list());

    if (error === null) {
      this.items = items;
      this.ready = true;
    }
  }

  /**
   * Lists a to-do's attachments.
   *
   * @param todo The to-do's ID.
   * @returns Its attachments, oldest first.
   */
  of(todo: string): ReadonlyArray<TAttachment> {
    return this.byTodo[todo] ?? [];
  }

  /**
   * Attaches files to a to-do, as many as the limits allow.
   *
   * @param todo The to-do's ID.
   * @param files The files, in order.
   * @returns The files that weren't attached, and why.
   */
  async add(todo: string, files: ReadonlyArray<TFileLike>): Promise<Array<TRefusal>> {
    const { accepted, refused } = planAttach(this.items, todo, files);

    if (accepted.length === 0) {
      return refused;
    }

    const [error, entries] = await tryCatch(async () => {
      const read = await Promise.all(accepted.map(async (file, index) => ({
        attachment: { id: createAttachmentId(), todo, name: attachmentName(file, this.now()), type: file.type, size: file.size, addedAt: this.now().getTime() + index },
        data: await file.arrayBuffer(),
      })));

      await this.repository.put(read);

      return read;
    });

    if (error !== null) {
      // Out of room on the disk, most likely, or the file went away.
      return [...accepted.map(file => ({ name: file.name, reason: error.name === "QuotaExceededError" ? "full" as const : "failed" as const })), ...refused];
    }

    this.items = [...this.items, ...entries.map(entry => entry.attachment)];

    return refused;
  }

  /**
   * Deletes an attachment.
   *
   * @param id Its ID.
   * @returns Whether it was deleted.
   */
  async remove(id: string): Promise<boolean> {
    const [error] = await tryCatch(async () => this.repository.remove([id]));

    if (error === null) {
      this.items = this.items.filter(item => item.id !== id);
    }

    return error === null;
  }

  /**
   * Deletes the attachments of to-dos that are gone for good (not in the list,
   * nor in the trash).
   *
   * @param keep The IDs of every to-do still there.
   * @returns How many were deleted.
   */
  async prune(keep: ReadonlySet<string>): Promise<number> {
    const gone = this.items.filter(item => !keep.has(item.todo)).map(item => item.id);

    if (!this.ready || gone.length === 0) {
      return 0;
    }

    const [error] = await tryCatch(async () => this.repository.remove(gone));

    if (error !== null) {
      return 0;
    }

    this.items = this.items.filter(item => !gone.includes(item.id));

    return gone.length;
  }

  /**
   * Reads an attachment's file.
   *
   * @param attachment The attachment.
   * @returns The file, or `null` when it can't be read.
   */
  async read(attachment: TAttachment): Promise<Blob | null> {
    const [error, blob] = await tryCatch(async () => this.repository.read(attachment));

    return error === null ? blob : null;
  }
}

/** The attachments on this device. */
export const attachments = new AttachmentStore(new AttachmentRepository(() => indexedDB));
