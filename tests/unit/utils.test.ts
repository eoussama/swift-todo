import { describe, expect, it } from "vitest";

import { cn } from "~/lib/utils";



describe("cn", () => {
  it("joins classes, drops falsy ones, and lets the last conflicting Tailwind class win", () => {
    const disabled = false;

    expect(cn("px-2 font-bold", disabled && "hidden", ["text-sm"], { italic: true }, "px-4")).toBe("font-bold text-sm italic px-4");
  });
});
