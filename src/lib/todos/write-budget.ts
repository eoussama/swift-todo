import type { TSyncLimits } from "./limits";

import { SAFETY } from "./limits";



const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const LOG_KEY = "writeLog";

/** Where the write log lives. `storage.session` is shared by the popup and the background, and clears when the browser closes. */
export type TBudgetArea = {
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
};

function waitFor(log: ReadonlyArray<number>, ops: number, limit: number, window: number, now: number): number {
  const overflow = log.length + ops - limit;

  if (overflow <= 0) {
    return 0;
  }

  // The window frees up once the `overflow` oldest writes fall out of it.
  const freeingWrite = log[overflow - 1];

  return freeingWrite === undefined ? window : Math.max(1, freeingWrite + window - now);
}

/**
 * Keeps sync writes under the browser's per-minute and per-hour limits
 * (with a safety margin), across every extension context. Use it inside the
 * storage lock so two contexts don't reserve the same slot.
 */
export class WriteBudget {
  private readonly perMinute: number;
  private readonly perHour: number;

  /**
   * Creates a budget.
   *
   * @param area Where the shared write log is kept.
   * @param limits The browser's write rate limits.
   * @param now Clock, replaceable in tests.
   */
  constructor(
    private readonly area: TBudgetArea,
    limits: Pick<TSyncLimits, "writesPerMinute" | "writesPerHour">,
    private readonly now: () => number = Date.now,
  ) {
    this.perMinute = Math.max(1, Math.floor(limits.writesPerMinute * SAFETY.writeRatio));
    this.perHour = Math.max(1, Math.floor(limits.writesPerHour * SAFETY.writeRatio));
  }

  /**
   * Reserves write operations, if they fit in both windows.
   *
   * @param ops How many write calls are about to be made.
   * @returns 0 when reserved, otherwise how many milliseconds to wait before trying again.
   */
  async reserve(ops: number): Promise<number> {
    if (ops <= 0) {
      return 0;
    }

    const now = this.now();
    const log = (await this.read()).filter(time => time > now - HOUR);
    const lastMinute = log.filter(time => time > now - MINUTE);
    const wait = Math.max(
      waitFor(lastMinute, ops, this.perMinute, MINUTE, now),
      waitFor(log, ops, this.perHour, HOUR, now),
    );

    if (wait > 0) {
      return wait;
    }

    for (let i = 0; i < ops; i++) {
      log.push(now);
    }

    await this.area.set({ [LOG_KEY]: log });

    return 0;
  }

  private async read(): Promise<Array<number>> {
    const value = (await this.area.get(LOG_KEY))[LOG_KEY];

    // Anything that isn't a list of times counts as no writes.
    return [value].flat().filter((time): time is number => typeof time === "number");
  }
}
