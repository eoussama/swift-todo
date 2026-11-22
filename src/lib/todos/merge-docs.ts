import { isObject } from "@eoussama/core";



/** Lists and settings are stored whole, one sync key each, so concurrent edits are merged rather than overwritten. */
export type TMergedDoc = "lists" | "prefs";

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Lists by their ID, skipping malformed entries (parseLists drops those later anyway).
function byId(value: unknown): Map<string, Record<string, unknown>> {
  // Stryker disable next-line ArrayDeclaration: entries that aren't lists are filtered out below anyway.
  const entries = Array.isArray(value) ? value : [];

  return new Map(entries.filter((entry): entry is Record<string, unknown> => isObject(entry) && typeof entry.i === "string").map(entry => [entry.i as string, entry]));
}

// Lists edited here merged with lists edited on another device since. Lists
// changed or added here win; lists added there are kept, after these; a list
// deleted on either side is gone.
function mergeLists(local: unknown, base: unknown, remote: unknown): Array<Record<string, unknown>> {
  const mine = byId(local);
  const before = byId(base);
  const theirs = byId(remote);
  const merged: Array<Record<string, unknown>> = [];

  for (const [id, entry] of mine) {
    // Deleted on the other device.
    if (before.has(id) && !theirs.has(id)) {
      continue;
    }

    const changedHere = !before.has(id) || !same(entry, before.get(id));

    // Unchanged here, and (not deleted there) still in sync: the other device's copy.
    merged.push(changedHere ? entry : theirs.get(id)!);
  }

  for (const [id, entry] of theirs) {
    if (!before.has(id) && !mine.has(id)) {
      merged.push(entry);
    }
  }

  return merged;
}

// Settings key by key: the ones changed here win, the rest come from the other device.
function mergeSettings(local: unknown, base: unknown, remote: unknown): unknown {
  if (!isObject(local) || !isObject(remote)) {
    return local;
  }

  const before = isObject(base) ? base : {};
  const merged: Record<string, unknown> = { ...remote };

  for (const key of new Set([...Object.keys(local), ...Object.keys(before)])) {
    if (!(key in local)) {
      delete merged[key];
    }
    else if (!same(local[key], before[key])) {
      merged[key] = local[key];
    }
  }

  return merged;
}

/**
 * Merges a list or settings document changed on this device with the copy in
 * sync, which another device may have changed since this one's edit began.
 *
 * @param key Which document.
 * @param local The value saved here.
 * @param base The value in sync when the change here began (empty when sync had none), or `undefined` when it isn't known (saved while sync was off).
 * @param remote The value in sync now, or `undefined` if there's none.
 * @returns The value to write.
 */
export function mergeDoc(key: TMergedDoc, local: unknown, base: unknown, remote: unknown): unknown {
  if (base === undefined || remote === undefined || same(remote, base)) {
    return local;
  }

  return key === "lists" ? mergeLists(local, base, remote) : mergeSettings(local, base, remote);
}
