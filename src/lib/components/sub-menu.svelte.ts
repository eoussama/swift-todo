/** Time to cross the gap between a submenu's item and the submenu. */
export const SUB_GRACE_MS = 200;

type TPointer = { onpointerenter: () => void; onpointerleave: () => void };

/**
 * Keeps a submenu open while the pointer is on its item or inside it, and
 * closes it a moment after the pointer leaves both, instead of leaving it open
 * until hovered and left again.
 */
export class SubMenu {
  open = $state(false);
  #onTrigger = false;
  #inside = false;
  #timer: ReturnType<typeof setTimeout> | undefined;

  /** For the item that opens the submenu. */
  readonly trigger: TPointer = {
    onpointerenter: () => (this.#onTrigger = true),
    onpointerleave: () => {
      this.#onTrigger = false;
      this.#closeSoon();
    },
  };

  /** For the submenu. */
  readonly content: TPointer = {
    onpointerenter: () => (this.#inside = true),
    onpointerleave: () => {
      this.#inside = false;
      this.#closeSoon();
    },
  };

  #closeSoon(): void {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      if (!this.#onTrigger && !this.#inside) {
        this.open = false;
      }
    }, SUB_GRACE_MS);
  }

  /** Stops waiting, when the menu goes away. */
  dispose(): void {
    clearTimeout(this.#timer);
  }
}
