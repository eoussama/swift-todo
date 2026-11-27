/**
 * One-time tips that point out what's easy to miss, each shown once on a
 * device, when it's useful: how to see a long to-do whole, the tabs' menus,
 * and the row menu's key.
 */
export type THint = "long" | "tabs" | "menu";

/** Where the tips already shown are remembered, in page `localStorage`. */
export const HINTS_KEY = "swift-todo:hints";

// The tips shown at the foot of the page, most useful first.
const PAGE_HINTS: ReadonlyArray<THint> = ["long", "tabs"];

function readSeen(): Array<THint> {
  try {
    const value = JSON.parse(String(localStorage.getItem(HINTS_KEY))) as unknown;

    return Array.isArray(value) ? value.filter((hint): hint is THint => ["long", "tabs", "menu"].includes(hint as string)) : [];
  }
  catch {
    return [];
  }
}

/** The tips: which were shown, which would help now, and the one to show. */
export class Hints {
  private seen = $state<Array<THint>>(readSeen());
  private wanted = $state<Array<THint>>([]);

  /** The tip to show at the foot of the page, if one would help and wasn't shown yet. */
  readonly current = $derived(PAGE_HINTS.find(hint => this.wanted.includes(hint) && !this.seen.includes(hint)) ?? null);

  /**
   * Tells whether a tip was shown already.
   *
   * @param hint The tip.
   * @returns Whether it's done with.
   */
  isSeen(hint: THint): boolean {
    return this.seen.includes(hint);
  }

  /**
   * Notes that a tip would help now (a to-do was cut short, a list made).
   *
   * @param hint The tip.
   */
  want(hint: THint): void {
    if (!this.wanted.includes(hint)) {
      this.wanted = [...this.wanted, hint];
    }
  }

  /**
   * Retires a tip: dismissed, or what it points out was done.
   *
   * @param hint The tip.
   */
  done(hint: THint): void {
    if (this.seen.includes(hint)) {
      return;
    }

    this.seen = [...this.seen, hint];

    try {
      localStorage.setItem(HINTS_KEY, JSON.stringify(this.seen));
    }
    catch {
      // Without storage, the tip is retired for as long as the popup stays open.
    }
  }
}

/** The popup's tips. */
export const hints = new Hints();
