/**
 * Quotas of `browser.storage.sync`. They are the same in Chrome, Edge and
 * Firefox. Chromium also exposes them on the API, which takes precedence
 * when present (see {@link resolveSyncLimits}).
 */
export type TSyncLimits = {
  /** Total bytes, measured as each key plus the JSON of its value. */
  quotaBytes: number;
  /** Bytes for a single key plus the JSON of its value. */
  quotaBytesPerItem: number;
  /** Number of keys. */
  maxItems: number;
  /** `set`, `remove` and `clear` calls per minute. */
  writesPerMinute: number;
  /** `set`, `remove` and `clear` calls per hour. */
  writesPerHour: number;
};

export const DEFAULT_SYNC_LIMITS: Readonly<TSyncLimits> = Object.freeze({
  quotaBytes: 102_400,
  quotaBytesPerItem: 8_192,
  maxItems: 512,
  writesPerMinute: 120,
  writesPerHour: 1_800,
});

/**
 * Limits enforced by the app itself. There is no cap on the number of to-dos:
 * those that don't fit in sync are kept on the device.
 */
export const TODO_LIMITS = Object.freeze({
  /** Longest to-do text, in UTF-16 code units (what `maxlength` counts). */
  maxTextLength: 500,
});

/** Share of the sync quotas the app allows itself to use. */
export const SAFETY = Object.freeze({
  /** New or grown to-dos stay on the device past this share of the byte quota. */
  quotaRatio: 0.95,
  /** Device-only to-dos move to sync only while usage stays under this share, so they don't bounce back and forth. */
  promoteRatio: 0.85,
  /** Share of the write rate limits the app allows itself. */
  writeRatio: 0.9,
  /** Keys kept free for metadata. */
  reservedItems: 4,
});

/** How long deleted to-dos stay in the trash before they are removed for good. */
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Usage share from which the UI shows the capacity meter. */
export const CAPACITY_WARNING_RATIO = 0.7;

/** Name of the alarm that flushes pending changes when no popup is open. */
export const FLUSH_ALARM = "swift-todo:flush";

/** Shortest alarm delay Chrome allows, in minutes. */
export const FLUSH_ALARM_DELAY_MINUTES = 0.5;

/** Quiet period after a change before pending changes are sent to sync. */
export const FLUSH_DEBOUNCE_MS = 400;

/** The quota constants Chromium exposes on `browser.storage.sync`. */
export type TSyncQuotaConstants = {
  QUOTA_BYTES?: unknown;
  QUOTA_BYTES_PER_ITEM?: unknown;
  MAX_ITEMS?: unknown;
  MAX_WRITE_OPERATIONS_PER_MINUTE?: unknown;
  MAX_WRITE_OPERATIONS_PER_HOUR?: unknown;
};

function pick(value: unknown, fallback: number): number {
  // Number.isFinite is false for anything that isn't a number.
  return Number.isFinite(value) && (value as number) > 0 ? value as number : fallback;
}

/**
 * Reads the quotas the browser reports, falling back to the documented defaults.
 *
 * @param area The sync storage area, or `undefined` when the browser has none.
 * @returns The quotas to plan writes against.
 */
export function resolveSyncLimits(area: TSyncQuotaConstants | undefined): TSyncLimits {
  return {
    quotaBytes: pick(area?.QUOTA_BYTES, DEFAULT_SYNC_LIMITS.quotaBytes),
    quotaBytesPerItem: pick(area?.QUOTA_BYTES_PER_ITEM, DEFAULT_SYNC_LIMITS.quotaBytesPerItem),
    maxItems: pick(area?.MAX_ITEMS, DEFAULT_SYNC_LIMITS.maxItems),
    writesPerMinute: pick(area?.MAX_WRITE_OPERATIONS_PER_MINUTE, DEFAULT_SYNC_LIMITS.writesPerMinute),
    writesPerHour: pick(area?.MAX_WRITE_OPERATIONS_PER_HOUR, DEFAULT_SYNC_LIMITS.writesPerHour),
  };
}
