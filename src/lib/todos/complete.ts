import type { TTodo } from "./model";
import type { TTodoRepository } from "./repository";

import { nextOccurrence } from "../time/recur";
import { addToHistory } from "./history";
import { positionAfter } from "./ordering";



/**
 * Checks a to-do off. A repeating one stays open instead: it moves to its next
 * due date and to the bottom of the list, leaves Today, and logs the check-off
 * in its history. The popup and the notification's "Done" button both use this.
 *
 * @param repository Where to save.
 * @param todo The to-do to check off.
 * @param now The current moment.
 * @param last The position of the last to-do, to move a repeating one after it.
 * @param stage A stage under Done to put it at (see `status.ts`), or `null` for plainly done.
 * @returns The next due date of a repeating to-do, or `null`.
 */
export async function completeTodo(repository: Pick<TTodoRepository, "update">, todo: TTodo, now: Date, last: string | null, stage: string | null = null): Promise<string | null> {
  // Stryker disable next-line ConditionalExpression: a null rule is invalid to nextOccurrence too, so it's checked off either way.
  if (todo.repeat !== null) {
    const next = nextOccurrence(todo.repeat, todo.due, now);

    if (next !== null) {
      // Its Today pin was for this occurrence, so it leaves Today until the next one is due.
      await repository.update(todo.id, {
        due: next,
        done: false,
        // It starts over: to do, at no stage.
        stage: null,
        today: null,
        history: addToHistory(todo.history, now),
        // Already last (or alone), it stays where it is.
        position: last === null || last <= todo.position ? todo.position : positionAfter(last),
      });

      return next;
    }
  }

  await repository.update(todo.id, { done: true, stage });

  return null;
}
