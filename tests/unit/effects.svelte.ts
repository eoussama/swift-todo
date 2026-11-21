import { flushSync } from "svelte";



/**
 * Runs code that sets up effects outside a component, the way a component
 * would while it initializes.
 *
 * @param setup Sets up the effects.
 * @returns A function that tears them down.
 */
export function withEffects(setup: () => void): () => void {
  const stop = $effect.root(setup);

  flushSync();

  return stop;
}

/**
 * Runs pending effects now.
 */
export function flush(): void {
  flushSync();
}

/**
 * Wraps a value in reactive state, for tests that change it and watch effects follow.
 *
 * @param value The starting value.
 * @returns The state, read and written through `current`.
 */
export function reactive<T>(value: T): { current: T } {
  let current = $state(value);

  return {
    get current() {
      return current;
    },
    set current(next: T) {
      current = next;
    },
  };
}
