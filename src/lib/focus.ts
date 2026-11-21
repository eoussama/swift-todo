import type { TTodo } from "./todos/model";



export type TFocusOptions = {
  /** The to-dos of the current view, in order. */
  visible: ReadonlyArray<TTodo>;
  /** Decides what's in Today. */
  isToday: (todo: TTodo) => boolean;
  /** To-dos skipped in this session, oldest first; they go to the back. */
  skipped: ReadonlyArray<string>;
};

/**
 * Orders what focus mode offers, one at a time: the open to-dos in Today,
 * or when Today is clear, the open ones in the current view. Skipped ones
 * wait at the back, in the order they were skipped.
 *
 * @param todos Every to-do, in order.
 * @param options The current view, the Today rule and what was skipped.
 * @returns The queue, first to do first.
 */
export function focusQueue(todos: ReadonlyArray<TTodo>, options: TFocusOptions): Array<TTodo> {
  const today = todos.filter(todo => !todo.done && options.isToday(todo));
  const pool = today.length > 0 ? today : options.visible.filter(todo => !todo.done);
  const rank = (todo: TTodo): number => options.skipped.indexOf(todo.id);

  return [...pool.filter(todo => rank(todo) === -1), ...pool.filter(todo => rank(todo) !== -1).sort((a, b) => rank(a) - rank(b))];
}
