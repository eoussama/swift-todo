// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

import { dialogForm, DRAFT_PREFIX, flagOf, keepDialog, openDialog, readDraft, readFields, readTodoDraft, saveDraft, textOf } from "~/lib/drafts.svelte";

import { flush, reactive, withEffects } from "./effects.svelte";



afterEach(() => {
  localStorage.clear();
});

describe("drafts", () => {
  it("keeps what's saved in page storage, and forgets it when told", () => {
    expect(readDraft("input")).toBeNull();

    saveDraft("input", { text: "Buy milk", ignore: false });
    expect(localStorage.getItem(`${DRAFT_PREFIX}input`)).toBe("{\"text\":\"Buy milk\",\"ignore\":false}");
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

describe("dialog drafts", () => {
  it("tells which dialog was open, on which to-do, and gives its form back only to it", () => {
    expect(openDialog()).toBeNull();

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

    const stop = withEffects(() => {
      keepDialog("link", { open: () => dialog.current.open, id: () => dialog.current.id, form: () => ({ value: dialog.current.value }) });
    });

    // Closed from the start: nothing to keep, nothing to forget.
    saveDraft("dialog", { kind: "view", id: "zzz999", form: {} });
    flush();
    expect(openDialog()).toEqual({ kind: "view", id: "zzz999" });

    dialog.current.open = true;
    flush();
    expect(dialogForm("link", "abc123")).toEqual({ value: "example.com" });

    dialog.current.value = "example.com/page";
    flush();
    expect(dialogForm("link", "abc123")).toEqual({ value: "example.com/page" });

    dialog.current.open = false;
    flush();
    expect(openDialog()).toBeNull();

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
    expect(openDialog()).toBeNull();

    stop();
  });
});
