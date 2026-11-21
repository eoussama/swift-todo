import type { TTodo } from "./model";
import type { TTodoRepository } from "./repository";

import { nextOccurrence } from "../time/recur";



/**
 * Checks a to-do off. A repeating one moves to its next due date and stays
 * open instead; the popup and the notification's "Done" button both use this.
 *
 * @param repository Where to save.
 * @param todo The to-do to check off.
 * @param now The current moment.
 * @returns The next due date of a repeating to-do, or `null`.
 */
export async function completeTodo(repository: Pick<TTodoRepository, "update">, todo: TTodo, now: Date): Promise<string | null> {
  if (todo.repeat !== null) {
    const next = nextOccurrence(todo.repeat, todo.due, now);

    if (next !== null) {
      await repository.update(todo.id, { due: next, done: false });

      return next;
    }
  }

  await repository.update(todo.id, { done: true });

  return null;
}
