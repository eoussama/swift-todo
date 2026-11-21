import type { TTodo } from "./model";
import type { TTodoRepository } from "./repository";

import { nextOccurrence } from "../time/recur";



/**
 * Checks a to-do off. A repeating one moves to its next due date and stays
 * open instead (and leaves Today); the popup and the notification's "Done"
 * button both use this.
 *
 * @param repository Where to save.
 * @param todo The to-do to check off.
 * @param now The current moment.
 * @returns The next due date of a repeating to-do, or `null`.
 */
export async function completeTodo(repository: Pick<TTodoRepository, "update">, todo: TTodo, now: Date): Promise<string | null> {
  // Stryker disable next-line ConditionalExpression: a null rule is invalid to nextOccurrence too, so it's checked off either way.
  if (todo.repeat !== null) {
    const next = nextOccurrence(todo.repeat, todo.due, now);

    if (next !== null) {
      // Its Today pin was for this occurrence, so it leaves Today until the next one is due.
      await repository.update(todo.id, { due: next, done: false, today: null });

      return next;
    }
  }

  await repository.update(todo.id, { done: true });

  return null;
}
