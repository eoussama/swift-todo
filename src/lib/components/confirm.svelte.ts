/**
 * How long a "click again to confirm" button waits for the second click before
 * it goes back to normal: time enough to find it again with a keyboard or a
 * screen reader.
 */
export const CONFIRM_MS = 6_000;

/**
 * A button that takes a second click within a few seconds, for what can't be
 * undone: the first click arms it, the second confirms.
 */
export class ConfirmTwice {
  /** Waiting for the second click. */
  armed = $state(false);
  #timer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Takes a click.
   *
   * @returns Whether it's the confirming one.
   */
  press(): boolean {
    clearTimeout(this.#timer);

    if (!this.armed) {
      this.armed = true;
      this.#timer = setTimeout(() => (this.armed = false), CONFIRM_MS);

      return false;
    }

    this.armed = false;

    return true;
  }

  /** Stops waiting, when the button goes away. */
  dispose(): void {
    clearTimeout(this.#timer);
  }
}
