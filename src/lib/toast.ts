import type { ExternalToast } from "svelte-sonner";

import { toast as sonner } from "svelte-sonner";



/** How long a toast stays, unless it says otherwise. */
export const TOAST_MS = 4_000;

type TId = string | number;
type TOptions = ExternalToast;
type TSonner = {
  (message: string, options?: TOptions): TId;
  success: (message: string, options?: TOptions) => TId;
  error: (message: string, options?: TOptions) => TId;
  dismiss: (id?: TId) => TId | undefined;
};

type TTimer = { remaining: number; started: number; handle: ReturnType<typeof setTimeout> | undefined; close: () => void };

/**
 * Shows toasts that close by themselves after a while, but never while held:
 * the pointer over them, or the focus in them, to read them or reach Undo.
 * The library pauses only some of the time (with one toast, not reliably), so
 * the toasts it shows never close by themselves, and these timers close them.
 *
 * @param library The toast library.
 * @param now Clock, replaceable in tests.
 * @returns The toast functions, and a way to hold them open.
 */
export function createToasts(library: TSonner, now: () => number = Date.now) {
  const timers = new Map<TId, TTimer>();
  let held = false;

  function run(timer: TTimer): void {
    timer.started = now();
    timer.handle = setTimeout(timer.close, timer.remaining);
  }

  function forget(id: TId): void {
    clearTimeout(timers.get(id)?.handle);
    timers.delete(id);
  }

  function show(kind: "default" | "success" | "error", message: string, options: TOptions = {}): TId {
    const create = kind === "default" ? library : library[kind];
    const id: TId = create(message, {
      ...options,
      duration: Number.POSITIVE_INFINITY,
      // Closed by hand (or by its own action), it doesn't close again later.
      onDismiss: (toast) => {
        forget(id);
        options.onDismiss?.(toast);
      },
    });
    const timer: TTimer = {
      remaining: options.duration ?? TOAST_MS,
      started: 0,
      handle: undefined,
      close: () => {
        forget(id);
        options.onAutoClose?.({ id, title: message } as Parameters<NonNullable<TOptions["onAutoClose"]>>[0]);
        library.dismiss(id);
      },
    };

    timers.set(id, timer);

    if (!held) {
      run(timer);
    }

    return id;
  }

  const toast = Object.assign((message: string, options?: TOptions) => show("default", message, options), {
    success: (message: string, options?: TOptions) => show("success", message, options),
    error: (message: string, options?: TOptions) => show("error", message, options),
    dismiss: (id?: TId) => {
      for (const key of id === undefined ? [...timers.keys()] : [id]) {
        forget(key);
      }

      return library.dismiss(id);
    },
  });

  /**
   * Holds the toasts open while the pointer or the focus is on them, and lets
   * them go on with the time they had left once it isn't.
   *
   * @param on Whether they're held.
   */
  function hold(on: boolean): void {
    if (on === held) {
      return;
    }

    held = on;

    for (const timer of timers.values()) {
      if (on) {
        clearTimeout(timer.handle);
        timer.remaining = Math.max(0, timer.remaining - (now() - timer.started));
      }
      else {
        run(timer);
      }
    }
  }

  return { toast, hold };
}

const toasts = createToasts(sonner as unknown as TSonner);

/** Shows a toast: `toast(message)`, `toast.success`, `toast.error`, and `toast.dismiss`. */
export const toast = toasts.toast;

/** Holds every toast open (the pointer or the focus is on them), or lets them go on. */
export const holdToasts = toasts.hold;
