import type { TTimer } from "./time/timer";

import { createTimer, parseTimer, readTimer, saveTimer, TIMER_KEY } from "./time/timer";



type TSessionArea = Parameters<typeof saveTimer>[0];

type TChanges = Record<string, { oldValue?: unknown; newValue?: unknown }>;

export type TStorageEvents = {
  addListener: (listener: (changes: TChanges, area: string) => void) => void;
  removeListener: (listener: (changes: TChanges, area: string) => void) => void;
};

/**
 * The focus timer as the popup sees it. It lives in session storage, where
 * the background counts it down on the badge even with the popup closed.
 */
export class FocusTimer {
  timer = $state<TTimer | null>(null);

  /**
   * Creates the timer view.
   *
   * @param area The session storage area.
   * @param events Storage change events.
   * @param onfinished Called when a running timer reaches its end.
   */
  constructor(private readonly area: TSessionArea, private readonly events: TStorageEvents, private readonly onfinished: (timer: TTimer) => void = () => {}) {}

  /**
   * Loads the running timer and follows changes to it.
   *
   * @returns A function that stops following them.
   */
  async start(): Promise<() => void> {
    const listener = (changes: TChanges, area: string): void => {
      const change = changes[TIMER_KEY];

      if (area !== "session" || change === undefined) {
        return;
      }

      const before = parseTimer(change.oldValue);

      this.timer = parseTimer(change.newValue);

      // The background clears a timer that ran out; one stopped early isn't "finished".
      if (this.timer === null && before !== null && before.endsAt <= Date.now() + 1_000) {
        this.onfinished(before);
      }
    };

    this.events.addListener(listener);
    this.timer = await readTimer(this.area);

    return () => this.events.removeListener(listener);
  }

  /**
   * Starts a timer, replacing any running one.
   *
   * @param minutes Its length.
   * @param todo The to-do being worked on, if any.
   * @returns Once saved.
   */
  async begin(minutes: number, todo: string | null): Promise<void> {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- A one-off timestamp, never mutated.
    this.timer = createTimer(minutes, todo, new Date());
    await saveTimer(this.area, this.timer);
  }

  /**
   * Stops the running timer.
   *
   * @returns Once saved.
   */
  async stop(): Promise<void> {
    this.timer = null;
    await saveTimer(this.area, null);
  }
}
