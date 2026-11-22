/**
 * Tells whether a value is one of a fixed set of strings, narrowing it.
 *
 * @param options The allowed values.
 * @param value The value to check.
 * @returns Whether it's one of them.
 */
export function isOneOf<T extends string>(options: ReadonlyArray<T>, value: unknown): value is T {
  return (options as ReadonlyArray<unknown>).includes(value);
}

/**
 * Tells whether two stored values are the same, by their JSON.
 *
 * @param a One value.
 * @param b The other.
 * @returns Whether they're the same.
 */
export function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
