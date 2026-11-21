// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { downloadText } from "~/lib/export/download";
import { hasNotifications, requestNotifications } from "~/lib/permissions";
import { createUiState, FILTER_KEY, FOCUS_KEY, FOCUS_SKIPPED_KEY, readFocusMode, readFocusSkipped, saveFocusMode, saveFocusSkipped } from "~/lib/ui-state";



describe("notifications permission", () => {
  it("checks and requests the optional permission", async () => {
    const contains = vi.spyOn(fakeBrowser.permissions, "contains").mockResolvedValue(true as never);
    const request = vi.spyOn(fakeBrowser.permissions, "request").mockResolvedValue(false as never);

    expect(await hasNotifications()).toBe(true);
    expect(contains).toHaveBeenCalledWith({ permissions: ["notifications"] });
    expect(await requestNotifications()).toBe(false);
    expect(request).toHaveBeenCalledWith({ permissions: ["notifications"] });
  });

  it("treats a failing API as not allowed", async () => {
    vi.spyOn(fakeBrowser.permissions, "contains").mockRejectedValue(new Error("unsupported"));
    vi.spyOn(fakeBrowser.permissions, "request").mockRejectedValue(new Error("not from a click"));

    expect(await hasNotifications()).toBe(false);
    expect(await requestNotifications()).toBe(false);
  });
});

describe("device UI state", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("uses fixed keys, which the background reads too", () => {
    expect(FILTER_KEY).toBe("ui:filter");
    expect(FOCUS_KEY).toBe("ui:focus");
  });

  it("ignores an empty saved filter", async () => {
    await fakeBrowser.storage.local.set({ [FILTER_KEY]: "" });
    expect(await createUiState().loadFilter()).toBeNull();
  });

  it("remembers the list filter and focus mode", async () => {
    const ui = createUiState();

    expect(await ui.loadFilter()).toBeNull();
    await ui.saveFilter("today");
    expect(await fakeBrowser.storage.local.get(FILTER_KEY)).toEqual({ [FILTER_KEY]: "today" });
    expect(await ui.loadFilter()).toBe("today");

    expect(await readFocusMode()).toBe(false);
    await saveFocusMode(true);
    expect(await fakeBrowser.storage.local.get(FOCUS_KEY)).toEqual({ [FOCUS_KEY]: true });
    expect(await readFocusMode()).toBe(true);

    await fakeBrowser.storage.local.set({ [FOCUS_KEY]: "yes" });
    expect(await readFocusMode()).toBe(false);
  });

  it("remembers the to-dos skipped in focus mode, in order, and ignores anything else stored there", async () => {
    expect(FOCUS_SKIPPED_KEY).toBe("ui:focus-skipped");
    expect(await readFocusSkipped()).toEqual([]);

    const ids = ["b", "a"];

    await saveFocusSkipped(ids);
    expect(await fakeBrowser.storage.local.get(FOCUS_SKIPPED_KEY)).toEqual({ [FOCUS_SKIPPED_KEY]: ["b", "a"] });
    expect(await readFocusSkipped()).toEqual(["b", "a"]);

    // A copy is saved, not the caller's array.
    ids.push("c");
    expect(await readFocusSkipped()).toEqual(["b", "a"]);

    await fakeBrowser.storage.local.set({ [FOCUS_SKIPPED_KEY]: ["x", 4, null, "y"] });
    expect(await readFocusSkipped()).toEqual(["x", "y"]);

    await fakeBrowser.storage.local.set({ [FOCUS_SKIPPED_KEY]: "x" });
    expect(await readFocusSkipped()).toEqual([]);
  });
});

describe("downloads", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves text through a temporary link and frees it later", async () => {
    vi.useFakeTimers();

    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:swift-todo/1");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clicked: Array<{ href: string; download: string; rel: string; attached: boolean }> = [];

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download, rel: this.rel, attached: this.isConnected });
    });

    downloadText("list.csv", "a,b", "text/csv");

    const blob = create.mock.calls[0]![0] as Blob;

    expect(blob.type).toBe("text/csv;charset=utf-8");
    expect(await blob.text()).toBe("a,b");
    expect(clicked).toEqual([{ href: "blob:swift-todo/1", download: "list.csv", rel: "noopener", attached: true }]);
    expect(document.querySelector("a")).toBeNull();

    vi.advanceTimersByTime(9_999);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revoke).toHaveBeenCalledWith("blob:swift-todo/1");
  });
});
