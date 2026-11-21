import { describe, expect, it, vi } from "vitest";

import { cn, mergeProps } from "~/lib/utils";



describe("cn", () => {
  it("joins classes, drops falsy ones, and lets the last conflicting Tailwind class win", () => {
    const disabled = false;

    expect(cn("px-2 font-bold", disabled && "hidden", ["text-sm"], { italic: true }, "px-4")).toBe("font-bold text-sm italic px-4");
  });
});

describe("mergeProps", () => {
  it("lets the element's own values win, even undefined ones, and keeps the trigger's others", () => {
    expect(mergeProps({ "id": "tip", "tabindex": 0, "data-state": "closed" }, { tabindex: -1, id: undefined }))
      .toEqual({ "id": undefined, "tabindex": -1, "data-state": "closed" });
  });

  it("runs both handlers of an event, the trigger's first, with the same arguments", () => {
    const calls: Array<string> = [];
    const event = new Event("click");
    const trigger = vi.fn((_: Event) => calls.push("trigger"));
    const own = vi.fn((_: Event) => calls.push("own"));
    const merged = mergeProps({ onclick: trigger }, { onclick: own });

    (merged.onclick as (event: Event) => void)(event);

    expect(calls).toEqual(["trigger", "own"]);
    expect(trigger).toHaveBeenCalledWith(event);
    expect(own).toHaveBeenCalledWith(event);
  });

  it("only chains functions, and only for events", () => {
    const trigger = (): void => {};
    const own = (): void => {};

    expect(mergeProps({ onclick: trigger }, { onclick: undefined }).onclick).toBeUndefined();
    expect(mergeProps({ onclick: "x" }, { onclick: own }).onclick).toBe(own);
    expect(mergeProps({ render: trigger }, { render: own }).render).toBe(own);
    expect(mergeProps({ onfocus: trigger }, {}).onfocus).toBe(trigger);
  });
});
