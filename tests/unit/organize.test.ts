import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { collectTags, completeTag, extractTags, normalizeTag, segmentText, suggestTags, tagQueryAt } from "~/lib/todos/tags";
import { TodoStore } from "~/lib/todos/todos.svelte";
import { filterTodos, listForNew, listOf, resolveFilter } from "~/lib/todos/view";
import { createUiState, FILTER_KEY, readFilter } from "~/lib/ui-state";

import { createDevice, memoryArea } from "./helpers";



const lists = [{ id: "work01", name: "Work", emoji: null }];

function todo(text: string, list: string | null = null) {
  return { text, list } as never;
}

describe("tags", () => {
  it("finds tags, ignoring ones glued to words", () => {
    expect(extractTags("Ship #Q3 report #q3 and #design-review, not C# or a#b or ##x")).toEqual(["q3", "design-review"]);
    expect(extractTags("#日本 #über")).toEqual(["日本", "über"]);
    expect(extractTags("no tags")).toEqual([]);
    expect(normalizeTag("#Work")).toBe("work");
  });

  it("splits text into plain parts and tags", () => {
    expect(segmentText("#start middle #end")).toEqual([
      { kind: "tag", value: "#start", tag: "start" },
      { kind: "text", value: " middle " },
      { kind: "tag", value: "#end", tag: "end" },
    ]);
    expect(segmentText("plain")).toEqual([{ kind: "text", value: "plain" }]);
  });

  it("collects tags by use", () => {
    expect(collectTags([{ text: "#b #a" }, { text: "#a" }, { text: "#c" }])).toEqual(["a", "b", "c"]);
  });

  it("finds and completes the tag being typed", () => {
    expect(tagQueryAt("Call #ma", 8)).toEqual({ query: "ma", start: 5 });
    expect(tagQueryAt("Call #", 6)).toEqual({ query: "", start: 5 });
    expect(tagQueryAt("Call ma", 7)).toBeNull();
    expect(tagQueryAt("C#", 2)).toBeNull();

    expect(completeTag("Call #ma", 5, 8, "mama")).toEqual({ text: "Call #mama ", caret: 11 });
    expect(completeTag("Call #mXX later", 5, 7, "mama")).toEqual({ text: "Call #mama later", caret: 10 });
  });

  it("suggests prefix matches first, without the exact tag", () => {
    expect(suggestTags(["home", "homework", "echo", "work"], "ho")).toEqual(["home", "homework", "echo"]);
    expect(suggestTags(["home"], "home")).toEqual([]);
    expect(suggestTags(["a", "b", "c"], "", 2)).toEqual(["a", "b"]);
  });
});

describe("view", () => {
  const todos = [todo("Inbox one"), todo("Work one #q3", "work01"), todo("Orphan", "gone01")];

  it("filters by list, treating unknown lists as the Inbox", () => {
    expect(filterTodos(todos, { filter: "all", tag: null, lists }).map(t => (t as { text: string }).text)).toHaveLength(3);
    expect(filterTodos(todos, { filter: "inbox", tag: null, lists }).map(t => (t as { text: string }).text)).toEqual(["Inbox one", "Orphan"]);
    expect(filterTodos(todos, { filter: "work01", tag: null, lists }).map(t => (t as { text: string }).text)).toEqual(["Work one #q3"]);
    expect(listOf(todos[2] as never, lists)).toBeNull();
  });

  it("filters by tag, and falls back to All for a deleted list", () => {
    expect(filterTodos(todos, { filter: "all", tag: "q3", lists })).toHaveLength(1);
    expect(filterTodos(todos, { filter: "deleted", tag: null, lists })).toHaveLength(3);
    expect(resolveFilter("deleted", lists)).toBe("all");
    expect(resolveFilter("today", lists)).toBe("today");
  });

  it("asks the Today rule for the Today view", () => {
    expect(filterTodos(todos, { filter: "today", tag: null, lists })).toEqual([]);
    expect(filterTodos(todos, { filter: "today", tag: null, lists, isToday: t => (t as { text: string }).text === "Orphan" })).toHaveLength(1);
  });

  it("files new to-dos in the open list, or the Inbox", () => {
    expect(listForNew("work01", lists)).toBe("work01");
    expect(listForNew("all", lists)).toBeNull();
    expect(listForNew("today", lists)).toBeNull();
    expect(listForNew("gone01", lists)).toBeNull();
  });
});

describe("ui state", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("remembers the open list in local storage", async () => {
    const ui = createUiState();

    expect(await ui.loadFilter()).toBeNull();
    await ui.saveFilter("work01");
    expect(await ui.loadFilter()).toBe("work01");
    expect(await fakeBrowser.storage.local.get(FILTER_KEY)).toEqual({ [FILTER_KEY]: "work01" });
  });

  it("ignores a malformed saved filter", async () => {
    const area = memoryArea();

    await area.set({ [FILTER_KEY]: 42 });
    expect(await readFilter(area)).toBeNull();
  });
});

describe("store filters", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the chosen list and tag, and restores the saved list", async () => {
    let saved: string | null = "work01";
    const device = createDevice();

    await device.repository.saveLists(lists);
    await device.repository.add("Inbox #x");
    await device.repository.add("Work #x", { list: "work01" });
    await device.repository.add("Work #y", { list: "work01" });

    const store = new TodoStore(device.repository, {
      ui: { loadFilter: async () => saved, saveFilter: async (filter) => {
        saved = filter;
      } },
    });

    await store.start();
    expect(store.activeFilter).toBe("work01");
    expect(store.visible.map(t => t.text)).toEqual(["Work #x", "Work #y"]);
    expect(store.remaining).toBe(2);

    store.setTagFilter("x");
    expect(store.visible.map(t => t.text)).toEqual(["Work #x"]);

    await store.setFilter("all");
    expect(saved).toBe("all");
    expect(store.visible.map(t => t.text)).toEqual(["Inbox #x", "Work #x"]);

    store.setTagFilter(null);
    expect(store.visible).toHaveLength(3);
  });

  it("still starts when the saved list can't be read", async () => {
    const store = new TodoStore(createDevice().repository, {
      ui: { loadFilter: async () => {
        throw new Error("nope");
      }, saveFilter: async () => {
        throw new Error("nope");
      } },
    });

    await store.start();
    await store.setFilter("inbox");
    expect(store.filter).toBe("inbox");
  });
});
