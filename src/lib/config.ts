/**
 * Shared application configuration constants.
 *
 * Centralizes business-rule values (status transitions, timeouts)
 * so they are easy to find and change in one place.
 */

import type { OrderStatusCode } from "../types";

// ---------------------------------------------------------------------------
// Status transition rules
// ---------------------------------------------------------------------------

/**
 * Map of manually allowed status transitions.
 *
 * Keys = current status, values = array of target statuses reachable
 * via the POST /orders/{id}/status endpoint.
 *
 * Statuses WYS, KOR, KOR_WYS are set **automatically** (by prepare-email
 * or edit auto-transition) and cannot be set manually through this map.
 *
 * ZRE and ANL are not keys here — restoring from those statuses is handled
 * exclusively by the POST /orders/{id}/restore endpoint.
 */
export const ALLOWED_MANUAL_STATUS_TRANSITIONS: Record<string, OrderStatusCode[]> = {
  ROB: ["ZRE", "ANL", "REK"],
  WYS: ["ZRE", "ANL", "REK"],
  KOR: ["ZRE", "ANL", "REK"],
  KOR_WYS: ["ZRE", "ANL", "REK"],
  REK: ["ROB", "ZRE", "ANL"],
};

/**
 * Statuses from which an order can be restored (via /restore endpoint).
 * ANL has an additional 24-hour time constraint checked at runtime.
 */
export const RESTORABLE_STATUSES: OrderStatusCode[] = ["ZRE", "ANL"];

// ---------------------------------------------------------------------------
// Locking
// ---------------------------------------------------------------------------

/** Lock auto-expiry time in minutes. After this period, another user can take over the lock. */
export const LOCK_TIMEOUT_MINUTES = 30;
