const encoder = new TextEncoder();

/**
 * Measures one key the way Chrome and Firefox count it against the sync
 * quota: the UTF-8 length of the key plus that of the value's JSON.
 *
 * @param key The storage key.
 * @param value The value stored under it.
 * @returns The size in bytes.
 */
export function itemBytes(key: string, value: unknown): number {
  return encoder.encode(key).byteLength + encoder.encode(JSON.stringify(value)).byteLength;
}

/**
 * Measures everything in a storage area the way the sync quota counts it.
 *
 * @param items Everything stored in the area.
 * @returns The total size in bytes.
 */
export function areaBytes(items: Record<string, unknown>): number {
  let total = 0;

  for (const [key, value] of Object.entries(items)) {
    total += itemBytes(key, value);
  }

  return total;
}
