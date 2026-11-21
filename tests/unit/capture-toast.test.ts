// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CAPTURE_TOAST_ID, showCaptureToast } from "~/lib/capture-toast";



describe("showCaptureToast", () => {
  // The note's shadow root is closed to the page; the tests keep a hold of it as it's made.
  let shadow: ShadowRoot | null = null;

  beforeEach(() => {
    vi.useFakeTimers();

    const attach = Element.prototype.attachShadow;

    vi.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, init: ShadowRootInit) {
      shadow = attach.call(this, init);

      return shadow;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.getElementById(CAPTURE_TOAST_ID)?.remove();
  });

  const host = () => document.getElementById(CAPTURE_TOAST_ID);
  const note = () => (host() === null ? null : shadow?.querySelector(".note"));

  it("shows the message in a status note, in its own shadow root, then removes it", () => {
    showCaptureToast("Added to Swift TODO", 1000);

    expect(host()?.parentElement).toBe(document.documentElement);
    expect(note()?.getAttribute("role")).toBe("status");
    expect(note()?.querySelector(".check")?.getAttribute("aria-hidden")).toBe("true");
    expect(note()?.querySelector(".check")?.textContent).toBe("✓");
    expect(shadow?.querySelector("style")?.textContent).toContain("z-index: 2147483647");
    // Closed to the page's own scripts.
    expect(host()?.shadowRoot).toBeNull();
    expect(Element.prototype.attachShadow).toHaveBeenCalledWith({ mode: "closed" });

    // The text arrives a moment later, so screen readers announce it.
    expect(note()?.textContent).toBe("✓");
    vi.advanceTimersByTime(30);
    expect(note()?.textContent).toBe("✓Added to Swift TODO");

    vi.advanceTimersByTime(969);
    expect(note()?.classList.contains("out")).toBe(false);
    vi.advanceTimersByTime(1);
    expect(note()?.classList.contains("out")).toBe(true);

    vi.advanceTimersByTime(249);
    expect(host()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(host()).toBeNull();
  });

  it("stays for 2.4 seconds by default", () => {
    showCaptureToast("Added");
    vi.advanceTimersByTime(2399);
    expect(note()?.classList.contains("out")).toBe(false);
    vi.advanceTimersByTime(1);
    expect(note()?.classList.contains("out")).toBe(true);
  });

  it("replaces a note still showing, so a second capture doesn't stack them", () => {
    showCaptureToast("First");
    showCaptureToast("Added 3 to-dos to Swift TODO");
    vi.advanceTimersByTime(30);

    expect(document.querySelectorAll(`#${CAPTURE_TOAST_ID}`)).toHaveLength(1);
    expect(note()?.textContent).toBe("✓Added 3 to-dos to Swift TODO");
  });
});
