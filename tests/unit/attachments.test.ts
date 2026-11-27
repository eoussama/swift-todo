import type { TFileLike } from "~/lib/attachments/attachments.svelte";

import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";

import { ATTACHMENT_LIMITS, attachmentName, AttachmentRepository, filesToAttach, formatSize, isPicture, planAttach } from "~/lib/attachments/attachments";
import { AttachmentStore, attachments as shared } from "~/lib/attachments/attachments.svelte";



const MB = 1024 * 1024;
const NOW = new Date(2026, 10, 27, 9, 5, 7);

function file(name: string, size: number, type = "text/plain", bytes?: Uint8Array): TFileLike {
  return { name, size, type, arrayBuffer: async () => (bytes ?? new Uint8Array(size)).buffer as ArrayBuffer };
}

function setup(factory = new IDBFactory()) {
  const repository = new AttachmentRepository(() => factory);

  return { repository, store: new AttachmentStore(repository, () => NOW), factory };
}

describe("planAttach", () => {
  it("takes files in order until a limit, saying why the others weren't", () => {
    const existing = [{ todo: "a", size: 1 }, { todo: "b", size: ATTACHMENT_LIMITS.totalBytes - 5 * MB }];
    const plan = planAttach(existing, "a", [
      { name: "empty", size: 0 },
      { name: "huge", size: ATTACHMENT_LIMITS.fileBytes + 1 },
      { name: "fits", size: 4 * MB },
      { name: "no room", size: MB },
      { name: "edge", size: ATTACHMENT_LIMITS.fileBytes },
    ]);

    expect(plan.accepted.map(entry => entry.name)).toEqual(["fits"]);
    expect(plan.refused).toEqual([
      { name: "empty", reason: "empty" },
      { name: "huge", reason: "too-big" },
      { name: "no room", reason: "full" },
      { name: "edge", reason: "full" },
    ]);
  });

  it("takes exactly as many as fit, on one to-do and in all", () => {
    const nine = Array.from({ length: ATTACHMENT_LIMITS.perTodo - 1 }, () => ({ todo: "a", size: 1 }));

    expect(planAttach(nine, "a", [{ name: "x", size: 1 }, { name: "y", size: 1 }]).refused).toEqual([{ name: "y", reason: "too-many" }]);
    // Others' attachments don't count against this one.
    expect(planAttach(nine, "b", [{ name: "x", size: 1 }, { name: "y", size: 1 }]).refused).toEqual([]);
    expect(planAttach([{ todo: "b", size: ATTACHMENT_LIMITS.totalBytes - 2 }], "a", [{ name: "x", size: 2 }]).refused).toEqual([]);
  });
});

describe("attachmentName", () => {
  it("keeps a file's own name, trimmed", () => {
    expect(attachmentName({ name: " notes.pdf ", type: "application/pdf" }, NOW)).toBe("notes.pdf");
    expect(attachmentName({ name: "image.png.zip", type: "application/zip" }, NOW)).toBe("image.png.zip");
  });

  it("names a pasted screenshot, or a nameless file, for when it came", () => {
    expect(attachmentName({ name: "image.png", type: "image/png" }, NOW)).toBe("Screenshot 2026-11-27 09.05.07.png");
    expect(attachmentName({ name: "image.jpeg", type: "image/jpeg" }, new Date(2026, 0, 2, 13, 40, 59))).toBe("Screenshot 2026-01-02 13.40.59.jpg");
    expect(attachmentName({ name: "", type: "" }, NOW)).toBe("Pasted file 2026-11-27 09.05.07");
  });
});

describe("file kinds", () => {
  it("shows pictures as thumbnails, but never SVG", () => {
    expect(isPicture("image/png")).toBe(true);
    expect(isPicture("image/webp")).toBe(true);
    expect(isPicture("image/svg+xml")).toBe(false);
  });

  it("attaches files pasted or dropped on their own, and leaves text to be text", () => {
    expect(filesToAttach({ files: ["shot"], types: ["Files"] })).toEqual(["shot"]);
    expect(filesToAttach({ files: ["cells"], types: ["text/plain", "text/html", "Files"] })).toEqual([]);
    expect(filesToAttach({ files: [], types: [] })).toEqual([]);
    expect(filesToAttach(null)).toEqual([]);
    expect(filesToAttach(undefined)).toEqual([]);
  });

  it("says sizes in bytes, KB or MB", () => {
    expect(formatSize(512, "en-US")).toBe("512 bytes");
    expect(formatSize(1536, "en-US")).toBe("1.5 kB");
    expect(formatSize(34 * 1024, "en-US")).toBe("34 kB");
    expect(formatSize(2.5 * MB, "en-US")).toBe("2.5 MB");
    expect(formatSize(12.4 * MB, "en-US")).toBe("12 MB");
  });
});

describe("attachmentStore", () => {
  it("attaches files to a to-do, keeps them across openings, and reads them back", async () => {
    const { store, factory } = setup();

    await store.start();
    expect(store.ready).toBe(true);

    const refused = await store.add("todo1", [file("a.txt", 3, "text/plain", new Uint8Array([104, 105, 33])), file("image.png", 2, "image/png")]);

    expect(refused).toEqual([]);
    expect(store.of("todo1").map(item => item.name)).toEqual(["a.txt", "Screenshot 2026-11-27 09.05.07.png"]);
    expect(store.of("other")).toEqual([]);

    // Another popup, later: the same files, oldest first.
    const again = setup(factory).store;

    await again.start();
    expect(again.of("todo1").map(item => item.name)).toEqual(["a.txt", "Screenshot 2026-11-27 09.05.07.png"]);

    const blob = await again.read(again.of("todo1")[0]!);

    expect(blob?.type).toBe("text/plain");
    expect(await blob?.text()).toBe("hi!");
  });

  it("refuses what's over the limits without storing anything for it", async () => {
    const { store } = setup();

    await store.start();
    expect(await store.add("t", [file("big", ATTACHMENT_LIMITS.fileBytes + 1)])).toEqual([{ name: "big", reason: "too-big" }]);
    expect(await store.add("t", [file("ok", 1), file("nothing", 0)])).toEqual([{ name: "nothing", reason: "empty" }]);
    expect(store.items).toHaveLength(1);
  });

  it("says a file failed when it can't be read or stored, and why", async () => {
    const { store, repository } = setup();

    await store.start();

    const broken = { ...file("gone.txt", 1), arrayBuffer: async () => Promise.reject(new Error("gone")) };

    expect(await store.add("t", [broken, file("bad", 0)])).toEqual([{ name: "gone.txt", reason: "failed" }, { name: "bad", reason: "empty" }]);

    vi.spyOn(repository, "put").mockRejectedValueOnce(new DOMException("No room", "QuotaExceededError"));
    expect(await store.add("t", [file("one.txt", 1)])).toEqual([{ name: "one.txt", reason: "full" }]);
    expect(store.items).toEqual([]);
  });

  it("deletes one, and the files of to-dos gone for good", async () => {
    const { store, factory } = setup();

    await store.start();
    await store.add("kept", [file("a", 1), file("b", 1)]);
    await store.add("gone", [file("c", 1)]);

    expect(await store.remove(store.of("kept")[0]!.id)).toBe(true);
    expect(store.of("kept").map(item => item.name)).toEqual(["b"]);

    expect(await store.prune(new Set(["kept"]))).toBe(1);
    expect(await store.prune(new Set(["kept"]))).toBe(0);
    expect(store.items.map(item => item.name)).toEqual(["b"]);

    const again = setup(factory).store;

    await again.start();
    expect(again.items.map(item => item.name)).toEqual(["b"]);
    expect(await again.read({ ...again.items[0]!, id: "missing" })).toBeNull();
  });

  it("cleans up nothing before it has loaded, or when deleting fails", async () => {
    const { store, repository } = setup();

    await store.add("x", [file("a", 1)]);
    expect(await store.prune(new Set())).toBe(0);

    await store.start();
    vi.spyOn(repository, "remove").mockRejectedValue(new Error("busy"));
    expect(await store.prune(new Set())).toBe(0);
    expect(await store.remove(store.items[0]!.id)).toBe(false);
    expect(store.items).toHaveLength(1);
  });

  it("works without IndexedDB, as if there were nothing, and tries again later", async () => {
    let available = false;
    const factory = new IDBFactory();
    const repository = new AttachmentRepository(() => {
      if (!available) {
        throw new Error("IndexedDB is off");
      }

      return factory;
    });
    const store = new AttachmentStore(repository);

    await store.start();
    expect(store.ready).toBe(false);
    expect(await store.read({ id: "x", todo: "t", name: "x", type: "", size: 1, addedAt: 0 })).toBeNull();

    available = true;
    await store.start();
    expect(store.ready).toBe(true);
    expect(await store.add("t", [file("a.txt", 1)])).toEqual([]);
    expect(store.items[0]!.addedAt).toBeGreaterThan(0);
  });

  it("reports a database that won't open, and a write that's undone", async () => {
    const factory = new IDBFactory();
    const repository = new AttachmentRepository(() => factory);

    // A newer version of the database can't be opened by this one.
    await new Promise<void>((resolve) => {
      const request = factory.open("swift-todo-files", 5);

      request.addEventListener("success", () => {
        request.result.close();
        resolve();
      });
    });

    await expect(repository.list()).rejects.toThrow();

    const fresh = new AttachmentRepository(() => new IDBFactory());
    const attachment = { id: "x", todo: "t", name: "x", type: "", size: 1, addedAt: 0 };

    await fresh.put([{ attachment, data: new ArrayBuffer(1) }]);
    // Never written over: the whole write is undone, the new one's details included.
    await expect(fresh.put([{ attachment: { ...attachment, id: "y" }, data: new ArrayBuffer(1) }, { attachment, data: new ArrayBuffer(2) }])).rejects.toThrow();
    expect((await fresh.list()).map(item => item.id)).toEqual(["x"]);
  });

  it("is shared by the popup, from the page's IndexedDB", async () => {
    expect(shared).toBeInstanceOf(AttachmentStore);
    // There's none outside a browser.
    await shared.start();
    expect(shared.ready).toBe(false);
  });
});
