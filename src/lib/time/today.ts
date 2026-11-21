import type { TTodo } from "../todos/model";

import { isDueByToday, toDateString } from "./date";



/**
 * Whether a to-do was added to Today, today. The pin is a date, so it
 * lapses by itself overnight.
 *
 * @param todo The to-do.
 * @param now The current moment.
 * @returns Whether it's pinned for today.
 */
export function isPinnedToday(todo: Pick<TTodo, "today">, now: Date): boolean {
  return todo.today === toDateString(now);
}

/**
 * Whether a to-do belongs in the Today view: pinned for today, or due by
 * today (overdue included). Done ones stay only for the day they were due,
 * so finished work doesn't pile up there.
 *
 * @param todo The to-do.
 * @param now The current moment.
 * @returns Whether it's in Today.
 */
export function isInToday(todo: Pick<TTodo, "done" | "due" | "today">, now: Date): boolean {
  if (isPinnedToday(todo, now)) {
    return true;
  }

  if (todo.due === null) {
    return false;
  }

  return todo.done ? todo.due.slice(0, 10) === toDateString(now) : isDueByToday(todo.due, now);
}
