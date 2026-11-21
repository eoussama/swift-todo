import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";



type TOrdered = { id: string; position: string };

/**
 * Gives the position for an item placed after another.
 *
 * @param last Position of the current last item, or `null` for an empty list.
 * @returns A position that sorts after `last`.
 */
export function positionAfter(last: string | null): string {
  // A malformed key (from an import or another tool) can't be built on; start a fresh one.
  // Stryker disable next-line ConditionalExpression: without the null check, null still ends up as null.
  return generateKeyBetween(last !== null && isOrderKey(last) ? last : null, null);
}

/**
 * Finds the position of the last to-do.
 *
 * @param todos The to-dos, in any order.
 * @returns The highest position, or `null` when there are none.
 */
export function lastPosition(todos: ReadonlyArray<{ position: string }>): string | null {
  let last: string | null = null;

  for (const { position } of todos) {
    // Stryker disable next-line EqualityOperator: >= only reassigns an equal position.
    if (last === null || position > last) {
      last = position;
    }
  }

  return last;
}

/**
 * Checks that a position is a valid order key, so new positions can be made
 * next to it. Imported backups can hold anything.
 *
 * @param position The position to check.
 * @returns Whether it's usable.
 */
export function isOrderKey(position: string): boolean {
  try {
    generateKeyBetween(position, null);

    return true;
  }
  catch {
    return false;
  }
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

  // Stryker disable next-line ConditionalExpression: with nothing after, the tie path below also moves only this item.
  const last = after === null;

  if (before === null || last || before < after) {
    return new Map([[id, generateKeyBetween(before, after)]]);
  }

  // Tie: widen the window to the nearest distinct positions on both sides.
  // (The item before the target is part of the tie, so the first step always widens.)
  let start = target;
  let end = target;

  while (start > 0 && rest[start - 1]!.position >= after) {
    start--;
  }

  while (end < rest.length - 1 && rest[end + 1]!.position <= before) {
    end++;
  }

  // The tied run gets fresh keys, so its own old position would be a valid bound too.
  // Stryker disable next-line ArithmeticOperator: rest[start + 1] is in the run, an equally valid lower bound.
  const lower = rest[start - 1]?.position ?? null;
  // Stryker disable next-line ArithmeticOperator: rest[end - 1] is in the run, an equally valid upper bound.
  const upper = rest[end + 1]?.position ?? null;
  const run = [...rest.slice(start, target), { id }, ...rest.slice(target, end + 1)];
  const keys = generateNKeysBetween(lower, upper, run.length);

  return new Map(run.map((item, index) => [item.id, keys[index]!]));
}
