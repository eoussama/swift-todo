// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

import { dialogForm, DRAFT_PREFIX, DRAFT_TTL_MS, expireDrafts, flagOf, keepDialog, openDialog, readDraft, readFields, readTodoDraft, saveDraft, stampDrafts, textOf } from "~/lib/drafts.svelte";

import { flush, reactive, withEffects } from "./effects.svelte";



afterEach(() => {
  localStorage.clear();
});

describe("drafts", () => {
  it("keeps what's saved in page storage, and forgets it when told", () => {
    expect(readDraft("input")).toBeNull();

    saveDraft("input", { text: "Buy milk", ignore: false });
    expect(DRAFT_PREFIX).toBe("swift-todo:draft:");
    expect(localStorage.getItem("swift-todo:draft:input")).toBe("{\"text\":\"Buy milk\",\"ignore\":false}");
    expect(readDraft("input")).toEqual({ text: "Buy milk", ignore: false });

    saveDraft("input", null);
    expect(readDraft("input")).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("reads nothing from a broken draft or unavailable storage, and saves nothing to it", () => {
    localStorage.setItem(`${DRAFT_PREFIX}input`, "{not json");
    expect(readDraft("input")).toBeNull();

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });

    expect(readDraft("input")).toBeNull();
    expect(() => saveDraft("input", "x")).not.toThrow();
  });

  it("reads fields, with fallbacks for anything missing or of the wrong kind", () => {
    saveDraft("input", { text: "Buy milk", ignore: true, count: 3 });

    const fields = readFields("input");

    expect(textOf(fields, "text", "")).toBe("Buy milk");
    expect(textOf(fields, "count", "none")).toBe("none");
    expect(flagOf(fields, "ignore", false)).toBe(true);
    expect(flagOf(fields, "text", false)).toBe(false);

    saveDraft("input", "just text");
    expect(readFields("input")).toEqual({});
    expect(readFields("missing")).toEqual({});
  });

  it("reads a to-do's draft only with its ID", () => {
    saveDraft("row", { id: "abc123", text: "Buy oat milk" });
    expect(readTodoDraft("row")).toEqual({ id: "abc123", fields: { id: "abc123", text: "Buy oat milk" } });

    saveDraft("row", { text: "Buy oat milk" });
    expect(readTodoDraft("row")).toBeNull();
  });
});

describe("draft freshness", () => {
  it("keeps drafts while the popup was open recently, and drops them all after a while away", () => {
    stampDrafts(1_000);
    saveDraft("input", { text: "Buy milk" });
    saveDraft("dialog", { kind: "link", id: "abc123", form: {} });
    localStorage.setItem("swift-todo:appearance", "{}");

    expireDrafts(1_000 + DRAFT_TTL_MS);
    expect(readDraft("input")).toEqual({ text: "Buy milk" });

    expireDrafts(1_001 + DRAFT_TTL_MS);
    expect(readDraft("input")).toBeNull();
    expect(readDraft("dialog")).toBeNull();
    expect(readDraft("seen")).toBeNull();
    // Only drafts: the rest of page storage stays.
    expect(localStorage.getItem("swift-todo:appearance")).toBe("{}");
  });

  it("drops drafts never stamped, notes the time on its own, and minds unavailable storage", () => {
    expect(DRAFT_TTL_MS).toBe(300_000);

    saveDraft("input", { text: "Buy milk" });
    expireDrafts(5);
    expect(readDraft("input")).toBeNull();

    vi.spyOn(Date, "now").mockReturnValue(42);
    stampDrafts();
    expect(readDraft("seen")).toBe(42);

    saveDraft("input", { text: "Buy milk" });
    expireDrafts();
    expect(readDraft("input")).toEqual({ text: "Buy milk" });

    vi.spyOn(Storage.prototype, "key").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => expireDrafts(DRAFT_TTL_MS * 2)).not.toThrow();
  });
});

describe("dialog drafts", () => {
  it("tells which dialog was open, on which to-do, and gives its form back only to it", () => {
    expect(openDialog()).toBeNull();
    expect(dialogForm("view", "abc123")).toBeNull();

    for (const kind of ["view", "schedule", "repeat", "link"] as const) {
      saveDraft("dialog", { kind, id: "abc123", form: {} });
      expect(openDialog()).toEqual({ kind, id: "abc123" });
    }

    saveDraft("dialog", { kind: "schedule", id: "abc123", form: { date: "2026-12-01" } });
    expect(openDialog()).toEqual({ kind: "schedule", id: "abc123" });
    expect(dialogForm("schedule", "abc123")).toEqual({ date: "2026-12-01" });
    expect(dialogForm("schedule", "other1")).toBeNull();
    expect(dialogForm("repeat", "abc123")).toBeNull();

    saveDraft("dialog", { kind: "schedule", id: "abc123", form: "broken" });
    expect(dialogForm("schedule", "abc123")).toBeNull();

    saveDraft("dialog", { kind: "settings", id: "abc123" });
    expect(openDialog()).toBeNull();
  });

  it("keeps a dialog's form while it's open, and forgets it once closed", () => {
    const dialog = reactive({ open: false, id: "abc123" as string | null, value: "example.com" });

    // Closed from the start, it leaves alone the draft it would open with.
    saveDraft("dialog", { kind: "link", id: "zzz999", form: {} });

    const stop = withEffects(() => {
      keepDialog("link", { open: () => dialog.current.open, id: () => dialog.current.id, form: () => ({ value: dialog.current.value }) });
    });

    expect(openDialog()).toEqual({ kind: "link", id: "zzz999" });
    dialog.current.id = "zzz999";
    flush();
    expect(openDialog()).toEqual({ kind: "link", id: "zzz999" });
    dialog.current.id = "abc123";

    dialog.current.open = true;
    flush();
    expect(dialogForm("link", "abc123")).toEqual({ value: "example.com" });

    dialog.current.value = "example.com/page";
    flush();
    expect(dialogForm("link", "abc123")).toEqual({ value: "example.com/page" });

    dialog.current.open = false;
    flush();
    expect(openDialog()).toBeNull();

    // Closed, it's done: a draft saved since then stays, whatever changes.
    saveDraft("dialog", { kind: "link", id: "other1", form: {} });
    dialog.current.id = "other1";
    flush();
    expect(openDialog()).toEqual({ kind: "link", id: "other1" });

    stop();
  });

  it("closes quietly when its draft is already gone", () => {
    const dialog = reactive({ open: true });

    const stop = withEffects(() => {
      keepDialog("schedule", { open: () => dialog.current.open, id: () => "abc123", form: () => ({}) });
    });

    localStorage.clear();
    dialog.current.open = false;
    expect(() => flush()).not.toThrow();
    expect(readDraft("dialog")).toBeNull();

    stop();
  });

  it("leaves another dialog's draft alone when it closes, and stops when its to-do goes", () => {
    const dialog = reactive({ open: true, id: "abc123" as string | null });

    const stop = withEffects(() => {
      keepDialog("repeat", { open: () => dialog.current.open, id: () => dialog.current.id, form: () => ({}) });
    });

    expect(openDialog()).toEqual({ kind: "repeat", id: "abc123" });

    // Another dialog took over before this one closed.
    saveDraft("dialog", { kind: "view", id: "abc123", form: {} });
    dialog.current.open = false;
    flush();
    expect(openDialog()).toEqual({ kind: "view", id: "abc123" });

    // Open again, then its to-do is gone.
    dialog.current.open = true;
    flush();
    dialog.current.id = null;
    flush();
    expect(readDraft("dialog")).toBeNull();

    stop();
  });
});
