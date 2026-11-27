import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createToasts, toast as shared, TOAST_MS } from "~/lib/toast";



type TOptions = { duration?: number; onDismiss?: (toast: unknown) => void; onAutoClose?: (toast: unknown) => void };

function fakeLibrary() {
  let next = 0;
  const shown = new Map<number, { kind: string; message: string; options: TOptions }>();
  const make = (kind: string) => (message: string, options: TOptions = {}) => {
    next++;
    shown.set(next, { kind, message, options });

    return next;
  };
  const dismiss = vi.fn((id?: string | number) => {
    for (const key of [...shown.keys()]) {
      if (id === undefined || key === id) {
        shown.delete(key);
      }
    }

    return id;
  });

  return { library: Object.assign(make("default"), { success: make("success"), error: make("error"), dismiss }), shown, dismiss };
}

describe("toasts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows each kind, never closing by itself in the library, and closes it after its time", () => {
    const { library, shown } = fakeLibrary();
    const { toast } = createToasts(library);
    const autoClosed = vi.fn();

    toast("Plain");
    toast.success("Yes");
    toast.error("No", { duration: 1_000, onAutoClose: autoClosed });

    expect([...shown.values()].map(entry => [entry.kind, entry.message, entry.options.duration])).toEqual([
      ["default", "Plain", Infinity],
      ["success", "Yes", Infinity],
      ["error", "No", Infinity],
    ]);

    vi.advanceTimersByTime(1_000);
    expect([...shown.values()].map(entry => entry.message)).toEqual(["Plain", "Yes"]);
    expect(autoClosed).toHaveBeenCalledWith({ id: 3, title: "No" });

    vi.advanceTimersByTime(TOAST_MS - 1_001);
    expect(shown.size).toBe(2);
    vi.advanceTimersByTime(1);
    expect(shown.size).toBe(0);
  });

  it("waits while held, then goes on with the time it had left", () => {
    const { library, shown } = fakeLibrary();
    const { toast, hold } = createToasts(library);

    toast("Read me", { duration: 1_000 });
    vi.advanceTimersByTime(600);
    hold(true);
    // Held again changes nothing.
    hold(true);
    vi.advanceTimersByTime(10_000);
    expect(shown.size).toBe(1);

    hold(false);
    hold(false);
    vi.advanceTimersByTime(399);
    expect(shown.size).toBe(1);
    vi.advanceTimersByTime(1);
    expect(shown.size).toBe(0);
  });

  it("starts a toast shown while held only once let go", () => {
    const { library, shown } = fakeLibrary();
    const { toast, hold } = createToasts(library);

    hold(true);
    toast("Arrived", { duration: 500 });
    vi.advanceTimersByTime(5_000);
    expect(shown.size).toBe(1);

    hold(false);
    vi.advanceTimersByTime(500);
    expect(shown.size).toBe(0);
  });

  it("forgets a toast closed by hand or dismissed, so it doesn't close again", () => {
    const { library, shown, dismiss } = fakeLibrary();
    const { toast, hold } = createToasts(library);
    const dismissed = vi.fn();

    const id = toast("Closed by hand", { duration: 500, onDismiss: dismissed });
    const other = toast("Dismissed", { duration: 500 });

    // The library calls back when its close button is used.
    shown.get(id as number)!.options.onDismiss!({ id });
    expect(dismissed).toHaveBeenCalledWith({ id });
    toast("Plain closed");
    shown.get(3)!.options.onDismiss!({ id: 3 });

    const kept = toast("Kept", { duration: 500 });

    expect(toast.dismiss(other)).toBe(other);
    // Gone already, a second word from the library changes nothing.
    shown.get(kept as number)!.options.onDismiss!({ id: kept });
    shown.get(kept as number)!.options.onDismiss!({ id: kept });
    dismiss.mockClear();
    hold(true);
    hold(false);
    vi.advanceTimersByTime(TOAST_MS);
    expect(dismiss).not.toHaveBeenCalled();
  });

  it("dismisses them all at once", () => {
    const { library, shown } = fakeLibrary();
    const { toast } = createToasts(library);

    toast("One");
    toast("Two");
    toast.dismiss();
    expect(shown.size).toBe(0);
    vi.advanceTimersByTime(TOAST_MS);
  });

  it("is the app's", () => {
    expect(typeof shared.success).toBe("function");
  });
});
