import { browser } from "wxt/browser";



const NOTIFICATIONS = { permissions: ["notifications" as const] };

/**
 * Whether this browser lets Swift TODO show notifications. It's an optional
 * permission, granted per device.
 *
 * @returns Whether notifications are allowed.
 */
export async function hasNotifications(): Promise<boolean> {
  try {
    return await browser.permissions.contains(NOTIFICATIONS);
  }
  catch {
    return false;
  }
}

/**
 * Asks to show notifications. Must run from a click or key press.
 *
 * @returns Whether notifications are allowed now.
 */
export async function requestNotifications(): Promise<boolean> {
  try {
    return await browser.permissions.request(NOTIFICATIONS);
  }
  catch {
    return false;
  }
}
