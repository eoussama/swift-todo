import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";



type TOrdered = { id: string; position: string };

/**
 * Gives the position for an item placed after another.
 *
 * @param last Position of the current last item, or `null` for an empty list.
 * @returns A position that sorts after `last`.
 */
export function positionAfter(last: string | null): string {
  return generateKeyBetween(last, null);
}

/**
 * Plans the position changes that move one item in an ordered list. Usually
 * only the moved item gets a new position, so a reorder is a single write and
 * two devices reordering different items never overwrite each other.
 *
 * When the neighbors share a position (two devices added items at the same
 * spot), the tied run is spread out again together with the moved item.
 *
 * @param list The items, sorted by position.
 * @param id ID of the item to move.
 * @param toIndex Index the item should end up at.
 * @returns New positions by ID; empty when nothing moves.
 */
export function planMove(list: ReadonlyArray<TOrdered>, id: string, toIndex: number): Map<string, string> {
  const fromIndex = list.findIndex(item => item.id === id);

  if (fromIndex === -1) {
    return new Map();
  }

  const target = Math.max(0, Math.min(toIndex, list.length - 1));

  if (target === fromIndex) {
    return new Map();
  }

  const rest = list.filter(item => item.id !== id);
  const before = rest[target - 1]?.position ?? null;
  const after = rest[target]?.position ?? null;

  if (before === null || after === null || before < after) {
    return new Map([[id, generateKeyBetween(before, after)]]);
  }

  // Tie: widen the window to the nearest distinct positions on both sides.
  let start = target - 1;
  let end = target;

  while (start > 0 && rest[start - 1]!.position >= after) {
    start--;
  }

  while (end < rest.length - 1 && rest[end + 1]!.position <= before) {
    end++;
  }

  const lower = rest[start - 1]?.position ?? null;
  const upper = rest[end + 1]?.position ?? null;
  const run = [...rest.slice(start, target), { id }, ...rest.slice(target, end + 1)];
  const keys = generateNKeysBetween(lower, upper, run.length);

  return new Map(run.map((item, index) => [item.id, keys[index]!]));
}
