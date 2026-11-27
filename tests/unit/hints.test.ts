// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

import { Hints, hints, HINTS_KEY } from "~/lib/hints.svelte";



afterEach(() => {
  localStorage.clear();
});

describe("hints", () => {
  it("shows a tip once it would help, the most useful first, until it's done", () => {
    const tips = new Hints();

    expect(HINTS_KEY).toBe("swift-todo:hints");
    expect(tips.current).toBeNull();

    tips.want("tabs");
    expect(tips.current).toBe("tabs");
    tips.want("long");
    tips.want("long");
    expect(tips.current).toBe("long");

    tips.done("long");
    expect(tips.isSeen("long")).toBe(true);
    expect(tips.current).toBe("tabs");
    expect(JSON.parse(localStorage.getItem(HINTS_KEY)!)).toEqual(["long"]);

    // The row menu's tip shows in the menu, not at the foot of the page.
    tips.done("tabs");
    tips.want("menu");
    expect(tips.current).toBeNull();
    expect(tips.isSeen("menu")).toBe(false);
  });

  it("remembers what was shown across popups, and keeps only tips it knows", () => {
    localStorage.setItem(HINTS_KEY, JSON.stringify(["tabs", "future", 3]));

    const tips = new Hints();

    expect(tips.isSeen("tabs")).toBe(true);
    tips.want("tabs");
    expect(tips.current).toBeNull();

    // Done twice, it's noted once.
    tips.done("menu");
    tips.done("menu");
    expect(JSON.parse(localStorage.getItem(HINTS_KEY)!)).toEqual(["tabs", "menu"]);
  });

  it("starts fresh from broken or missing storage, and copes without it", () => {
    localStorage.setItem(HINTS_KEY, "{broken");
    expect(new Hints().isSeen("long")).toBe(false);

    localStorage.setItem(HINTS_KEY, JSON.stringify({ long: true }));
    expect(new Hints().isSeen("long")).toBe(false);

    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("full");
    });

    const tips = new Hints();

    expect(() => tips.done("long")).not.toThrow();
    expect(tips.isSeen("long")).toBe(true);
    expect(hints).toBeInstanceOf(Hints);
  });
});
