import type { TCaptureDeps } from "~/lib/capture";

import { describe, expect, it, vi } from "vitest";

import { createCapture } from "~/lib/capture";



// Saturday 2026-11-21, 10:30 local time.
const NOW = new Date(2026, 10, 21, 10, 30);

function setup(overrides: Partial<TCaptureDeps> = {}) {
  const deps = {
    runInTab: vi.fn<TCaptureDeps["runInTab"]>(async () => [{ result: "Buy milk\n- Call mom tomorrow" }]),
    lists: vi.fn(async () => [{ id: "work01", name: "Work", emoji: null }]),
    filter: vi.fn(async () => "work01"),
    addMany: vi.fn(async () => []),
    flash: vi.fn(async () => {}),
    toast: vi.fn(async () => {}),
    now: () => NOW,
    ...overrides,
  };

  return { deps, capture: createCapture(deps) };
}

describe("adding a selection from the right-click menu", () => {
  it("reads the selection with its line breaks, files each line in the open list, linked to the page", async () => {
    const { deps, capture } = setup();

    expect(await capture({ selectionText: "Buy milk - Call mom tomorrow", pageUrl: "https://example.com/a", frameId: 3 }, { id: 7, title: "A page" })).toBe(2);
    expect(deps.runInTab).toHaveBeenCalledWith(7, 3);
    expect(deps.addMany).toHaveBeenCalledWith([
      { text: "Buy milk", fields: expect.objectContaining({ list: "work01", source: { url: "https://example.com/a", title: "A page" } }) },
      { text: "Call mom", fields: expect.objectContaining({ list: "work01", due: "2026-11-22" }) },
    ]);
    expect(deps.flash).toHaveBeenCalledWith(2);
    expect(deps.toast).toHaveBeenCalledWith(7, 2);
  });

  it("falls back to the menu's flattened text when the page refuses scripts or has nothing", async () => {
    for (const runInTab of [vi.fn(async () => Promise.reject(new Error("Cannot access a chrome:// URL"))), vi.fn(async () => [{ result: "   " }]), vi.fn(async () => [{ result: 5 }]), vi.fn(async () => [])]) {
      const { deps, capture } = setup({ runInTab });

      expect(await capture({ selectionText: "Read the docs" }, { id: 1, url: "https://example.com/docs" })).toBe(1);
      // The tab's address stands in for the page's.
      expect(deps.addMany).toHaveBeenCalledWith([{ text: "Read the docs", fields: expect.objectContaining({ source: { url: "https://example.com/docs", title: null } }) }]);
    }
  });

  it("without a tab, uses the menu's text and shows no note", async () => {
    const { deps, capture } = setup();

    expect(await capture({ selectionText: "Plan the trip", pageUrl: "https://example.com" })).toBe(1);
    expect(deps.runInTab).not.toHaveBeenCalled();
    expect(deps.flash).toHaveBeenCalledWith(1);
    expect(deps.toast).not.toHaveBeenCalled();
  });

  it("links nothing when it knows neither the tab nor the page", async () => {
    const { deps, capture } = setup();

    expect(await capture({ selectionText: "Plan the trip" })).toBe(1);
    expect(deps.addMany).toHaveBeenCalledWith([{ text: "Plan the trip", fields: expect.objectContaining({ source: null }) }]);
  });

  it("adds nothing, and flashes nothing, for an empty selection", async () => {
    const { deps, capture } = setup({ runInTab: vi.fn(async () => [{ result: "" }]) });

    expect(await capture({}, { id: 2 })).toBe(0);
    expect(deps.addMany).not.toHaveBeenCalled();
    expect(deps.flash).not.toHaveBeenCalled();
    expect(deps.toast).not.toHaveBeenCalled();
  });

  it("keeps the badge when the page refuses the note, and links nothing for a page that isn't on the web", async () => {
    const { deps, capture } = setup({ toast: vi.fn(async () => Promise.reject(new Error("no access"))) });

    await expect(capture({ pageUrl: "chrome://settings" }, { id: 4 })).resolves.toBe(2);
    expect(vi.mocked(deps.addMany).mock.calls[0]![0][0]!.fields.source).toBeNull();
    expect(deps.flash).toHaveBeenCalledWith(2);
  });
});
