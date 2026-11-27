// @vitest-environment happy-dom
import type { TPeekKey } from "~/lib/prefs/prefs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PEEK_HOLD_MS, watchPeek } from "~/lib/peek";



describe("watchPeek", () => {
  let target: EventTarget;
  let root: HTMLElement;
  let key: TPeekKey;
  let stop: () => void;

  const press = (name: string, init: KeyboardEventInit = {}): boolean => target.dispatchEvent(new KeyboardEvent("keydown", { key: name, ...init }));
  const release = (name: string): boolean => target.dispatchEvent(new KeyboardEvent("keyup", { key: name }));
  const peeking = (): boolean => root.dataset.peek !== undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    target = new EventTarget();
    root = document.createElement("div");
    key = "shift";
    stop = watchPeek(target as Window, root, () => key);
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  it("opens to-dos up once the key has been held a moment, until it's let go", () => {
    press("Shift");
    vi.advanceTimersByTime(PEEK_HOLD_MS - 1);
    expect(peeking()).toBe(false);

    vi.advanceTimersByTime(1);
    expect(peeking()).toBe(true);
    expect(root.dataset.peek).toBe("");

    // Held down, the key repeats without changing anything.
    press("Shift", { repeat: true });
    expect(peeking()).toBe(true);

    release("Shift");
    expect(peeking()).toBe(false);
  });

  it("leaves the key a modifier: another key cancels, and holding on doesn't start again", () => {
    press("Shift");
    press("A", { shiftKey: true });
    vi.advanceTimersByTime(PEEK_HOLD_MS * 2);
    expect(peeking()).toBe(false);

    press("Shift", { repeat: true });
    vi.advanceTimersByTime(PEEK_HOLD_MS * 2);
    expect(peeking()).toBe(false);

    // Already open, another key closes it too.
    release("Shift");
    press("Shift");
    vi.advanceTimersByTime(PEEK_HOLD_MS);
    press("Enter", { shiftKey: true });
    expect(peeking()).toBe(false);
  });

  it("waits only once for a press, and ignores other keys let go", () => {
    press("Shift");
    vi.advanceTimersByTime(PEEK_HOLD_MS / 2);
    // A second Shift (the other side) doesn't restart the wait.
    press("Shift");
    vi.advanceTimersByTime(PEEK_HOLD_MS / 2);
    expect(peeking()).toBe(true);

    press("Shift");
    release("A");
    expect(peeking()).toBe(true);

    // Let go, nothing left waiting opens it again.
    release("Shift");
    vi.advanceTimersByTime(PEEK_HOLD_MS * 2);
    expect(peeking()).toBe(false);
  });

  it("hears keys before the page does, so one it stops still counts", () => {
    stop();

    const add = vi.fn();
    const remove = vi.fn();

    stop = watchPeek({ addEventListener: add, removeEventListener: remove }, root, () => key);
    stop();

    for (const type of ["keydown", "keyup", "blur"]) {
      const listener = add.mock.calls.find(call => call[0] === type)?.[1];

      expect(add).toHaveBeenCalledWith(type, listener, true);
      expect(remove).toHaveBeenCalledWith(type, listener, true);
    }

    stop = watchPeek(target as Window, root, () => key);
  });

  it("follows the chosen key, Ctrl and Cmd alike, and nothing when off", () => {
    key = "ctrl";
    press("Shift");
    vi.advanceTimersByTime(PEEK_HOLD_MS);
    expect(peeking()).toBe(false);

    press("Meta");
    vi.advanceTimersByTime(PEEK_HOLD_MS);
    expect(peeking()).toBe(true);
    release("Meta");

    press("Control");
    vi.advanceTimersByTime(PEEK_HOLD_MS);
    expect(peeking()).toBe(true);
    release("Control");

    key = "alt";
    press("Alt");
    vi.advanceTimersByTime(PEEK_HOLD_MS);
    expect(peeking()).toBe(true);
    release("Alt");

    key = "off";
    press("Shift");
    vi.advanceTimersByTime(PEEK_HOLD_MS);
    expect(peeking()).toBe(false);
    release("Shift");
    expect(peeking()).toBe(false);
  });

  it("closes when the popup loses focus, and when it stops watching", () => {
    press("Shift");
    vi.advanceTimersByTime(PEEK_HOLD_MS);
    target.dispatchEvent(new Event("blur"));
    expect(peeking()).toBe(false);

    press("Shift");
    vi.advanceTimersByTime(PEEK_HOLD_MS);
    stop();
    expect(peeking()).toBe(false);

    press("Shift");
    vi.advanceTimersByTime(PEEK_HOLD_MS);
    expect(peeking()).toBe(false);
  });

  it("waits as long as asked", () => {
    stop();
    stop = watchPeek(target as Window, root, () => "shift", 50);
    press("Shift");
    vi.advanceTimersByTime(50);
    expect(peeking()).toBe(true);
  });
});
