/**
 * Testy wspólnego modułu statusów (lib/order-status.ts).
 */

import { describe, expect, it } from "vitest";

import {
  ALLOWED_MANUAL_STATUS_TRANSITIONS,
  EMAIL_SENDABLE_STATUSES,
  isManualTransitionAllowed,
  ORDER_STATUS,
  ORDER_STATUS_CODES,
  STATUS_AFTER_EMAIL,
  TERMINAL_STATUSES,
} from "../order-status";

describe("ORDER_STATUS", () => {
  it("zawiera 7 unikalnych kodów zgodnych z order_statuses.code", () => {
    expect(new Set(ORDER_STATUS_CODES).size).toBe(7);
    expect(ORDER_STATUS_CODES).toEqual([
      "robocze",
      "wysłane",
      "korekta",
      "korekta wysłane",
      "zrealizowane",
      "reklamacja",
      "anulowane",
    ]);
  });

  it("statusy końcowe to zrealizowane i anulowane", () => {
    expect([...TERMINAL_STATUSES].sort()).toEqual(["anulowane", "zrealizowane"]);
  });
});

describe("isManualTransitionAllowed", () => {
  // Poprzednia matryca backendu (cel → dozwolone statusy bieżące) — regresja po unifikacji
  const legacyBackendMatrix: Record<string, string[]> = {
    zrealizowane: ["robocze", "wysłane", "korekta", "korekta wysłane", "reklamacja"],
    reklamacja: ["wysłane", "korekta", "korekta wysłane"],
    anulowane: ["robocze", "wysłane", "korekta", "korekta wysłane", "reklamacja"],
  };

  it("jest zgodna z dotychczasową matrycą backendu dla każdej pary statusów", () => {
    for (const from of ORDER_STATUS_CODES) {
      for (const to of ORDER_STATUS_CODES) {
        const expected = legacyBackendMatrix[to]?.includes(from) ?? false;
        expect(isManualTransitionAllowed(from, to), `${from} → ${to}`).toBe(expected);
      }
    }
  });

  it("nie pozwala na ręczne ustawienie statusów wysłanych", () => {
    for (const targets of Object.values(ALLOWED_MANUAL_STATUS_TRANSITIONS)) {
      expect(targets).not.toContain(ORDER_STATUS.SENT);
      expect(targets).not.toContain(ORDER_STATUS.CORRECTION_SENT);
    }
  });

  it("zwraca false dla nieznanego statusu", () => {
    expect(isManualTransitionAllowed("nieznany", ORDER_STATUS.CANCELLED)).toBe(false);
  });
});

describe("wysyłka maila", () => {
  it("każdy status wysyłalny ma status docelowy po wysłaniu", () => {
    for (const status of EMAIL_SENDABLE_STATUSES) {
      expect(STATUS_AFTER_EMAIL[status]).toBeDefined();
    }
    expect(STATUS_AFTER_EMAIL[ORDER_STATUS.DRAFT]).toBe(ORDER_STATUS.SENT);
    expect(STATUS_AFTER_EMAIL[ORDER_STATUS.CORRECTION]).toBe(ORDER_STATUS.CORRECTION_SENT);
  });
});
