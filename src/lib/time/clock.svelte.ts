/**
 * A reactive clock for the UI, so labels like "Today" and "Overdue", and
 * the Today view, stay right while the popup is open.
 */
export class Clock {
  // Dates here are replaced on each tick, never mutated, so plain Date is right.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  now = $state(new Date());

  /**
   * Starts ticking.
   *
   * @param intervalMs How often to tick.
   * @returns A function that stops it.
   */
  start(intervalMs = 60_000): () => void {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const timer = setInterval(() => (this.now = new Date()), intervalMs);

    return () => clearInterval(timer);
  }
}
