import { customAlphabet } from "nanoid";



/**
 * A file or screenshot attached to a to-do. Attachments stay on the device
 * they were added on: sync has room for text, not files.
 */
export type TAttachment = {
  id: string;
  /** The to-do it belongs to. */
  todo: string;
  name: string;
  /** Its media type, or "" when unknown. */
  type: string;
  /** In bytes. */
  size: number;
  addedAt: number;
};

const MB = 1024 * 1024;

export const ATTACHMENT_LIMITS = Object.freeze({
  /** Largest file taken. */
  fileBytes: 10 * MB,
  /** Most files on one to-do. */
  perTodo: 10,
  /** All attachments together, on this device. */
  totalBytes: 100 * MB,
});

/** Why a file wasn't attached. */
export type TRefusalReason = "empty" | "too-big" | "too-many" | "full" | "failed";
export type TRefusal = { name: string; reason: TRefusalReason };

/** The name and size of a file to attach, all that's checked before reading it. */
type TCandidate = { name: string; size: number };

/**
 * Decides which files can be attached to a to-do, in order, within the limits.
 *
 * @param existing Every attachment on the device.
 * @param todo The to-do.
 * @param files The files offered.
 * @returns The files taken, and why the others weren't.
 */
export function planAttach<T extends TCandidate>(existing: ReadonlyArray<Pick<TAttachment, "todo" | "size">>, todo: string, files: ReadonlyArray<T>): { accepted: Array<T>; refused: Array<TRefusal> } {
  let count = existing.filter(item => item.todo === todo).length;
  let total = existing.reduce((sum, item) => sum + item.size, 0);
  const accepted: Array<T> = [];
  const refused: Array<TRefusal> = [];

  for (const file of files) {
    const reason: TRefusalReason | null = file.size === 0
      ? "empty"
      : file.size > ATTACHMENT_LIMITS.fileBytes
        ? "too-big"
        : count >= ATTACHMENT_LIMITS.perTodo
          ? "too-many"
          : total + file.size > ATTACHMENT_LIMITS.totalBytes ? "full" : null;

    if (reason === null) {
      accepted.push(file);
      count++;
      total += file.size;
    }
    else {
      refused.push({ name: file.name, reason });
    }
  }

  return { accepted, refused };
}

const pad = (value: number): string => String(value).padStart(2, "0");

/**
 * Names a file. A pasted screenshot comes as a bare "image.png", so it's named
 * for when it was pasted instead; a file with no name gets one too.
 *
 * @param file The file's name and type.
 * @param file.name Its name.
 * @param file.type Its media type.
 * @param now When it was added.
 * @returns The name to keep.
 */
export function attachmentName(file: { name: string; type: string }, now: Date): string {
  const name = file.name.trim();

  if (name !== "" && !/^image\.\w+$/u.test(name)) {
    return name;
  }

  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`;
  const extension = /^image\/(\w+)/u.exec(file.type)?.[1]?.replace("jpeg", "jpg") ?? null;

  return extension === null ? `Pasted file ${stamp}` : `Screenshot ${stamp}.${extension}`;
}

/** Pictures shown as thumbnails. SVG isn't one: it can carry scripts. */
const PICTURES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "image/bmp"]);

/**
 * Tells whether an attachment is a picture, shown as a thumbnail.
 *
 * @param type Its media type.
 * @returns Whether it is.
 */
export function isPicture(type: string): boolean {
  return PICTURES.has(type);
}

/**
 * Picks the files to attach from something pasted or dropped. Text wins: a
 * spreadsheet's cells come with a picture of them, and pasting them is pasting
 * text. Only files on their own (a screenshot, files copied in a file manager)
 * are attached.
 *
 * @param data The clipboard's or the drop's data.
 * @param data.files The files in it.
 * @param data.types The kinds of data in it.
 * @returns The files, or none.
 */
export function filesToAttach<T>(data: { files: ArrayLike<T>; types: ReadonlyArray<string> } | null | undefined): Array<T> {
  return data == null || data.types.includes("text/plain") ? [] : Array.from(data.files);
}

/**
 * Says how big a file is, in bytes, KB or MB.
 *
 * @param bytes The size.
 * @param locale The locale; the browser's by default.
 * @returns "512 bytes", "34 KB", "2.5 MB"…
 */
export function formatSize(bytes: number, locale?: string): string {
  const [value, unit] = bytes < 1024 ? [bytes, "byte"] : bytes < MB ? [bytes / 1024, "kilobyte"] : [bytes / MB, "megabyte"];

  return new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: unit === "byte" ? "long" : "short", maximumFractionDigits: value < 10 ? 1 : 0 }).format(value);
}

/** Creates an attachment ID. */
export const createAttachmentId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);

const DB_NAME = "swift-todo-files";
const DB_VERSION = 1;
// What's listed, and the bytes, apart: listing never reads the files.
const META = "meta";
const DATA = "data";

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

// A request that fails aborts its transaction, which then reports that error.
function committed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("abort", () => reject(transaction.error));
  });
}

/** Attachments on this device, in IndexedDB, shared by the popup and the rest of the extension. */
export class AttachmentRepository {
  #db: Promise<IDBDatabase> | undefined;

  /**
   * Creates a repository.
   *
   * @param factory Gives the IndexedDB to use, only once it's needed.
   */
  constructor(private readonly factory: () => IDBFactory) {}

  private async open(): Promise<IDBDatabase> {
    this.#db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.factory().open(DB_NAME, DB_VERSION);

      request.addEventListener("upgradeneeded", () => {
        request.result.createObjectStore(META, { keyPath: "id" });
        request.result.createObjectStore(DATA);
      });
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error));
    });

    try {
      return await this.#db;
    }
    catch (error) {
      // Try again next time.
      this.#db = undefined;
      throw error;
    }
  }

  /**
   * Lists every attachment, oldest first.
   *
   * @returns Their details, without the files.
   */
  async list(): Promise<Array<TAttachment>> {
    const db = await this.open();
    const items = await done(db.transaction(META).objectStore(META).getAll() as IDBRequest<Array<TAttachment>>);

    return items.sort((a, b) => a.addedAt - b.addedAt);
  }

  /**
   * Reads an attachment's file.
   *
   * @param attachment The attachment.
   * @returns The file, or `null` when it's gone.
   */
  async read(attachment: Pick<TAttachment, "id" | "type">): Promise<Blob | null> {
    const db = await this.open();
    const data = await done(db.transaction(DATA).objectStore(DATA).get(attachment.id) as IDBRequest<ArrayBuffer | undefined>);

    return data === undefined ? null : new Blob([data], { type: attachment.type });
  }

  /**
   * Stores new attachments. Their details and files are written together, or not at all.
   *
   * @param entries The attachments, each with its file's bytes.
   * @returns Once stored.
   */
  async put(entries: ReadonlyArray<{ attachment: TAttachment; data: ArrayBuffer }>): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction([META, DATA], "readwrite");

    // Added, not put: an attachment is never written over.
    const requests = entries.flatMap(({ attachment, data }) => [
      transaction.objectStore(META).add(attachment),
      transaction.objectStore(DATA).add(data, attachment.id),
    ]);

    await Promise.all([...requests.map(done), committed(transaction)]);
  }

  /**
   * Deletes attachments, with their files.
   *
   * @param ids Their IDs.
   * @returns Once deleted.
   */
  async remove(ids: ReadonlyArray<string>): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction([META, DATA], "readwrite");

    for (const id of ids) {
      transaction.objectStore(META).delete(id);
      transaction.objectStore(DATA).delete(id);
    }

    await committed(transaction);
  }
}
