/**
 * Testy weekNumberToDateRange (week-utils.ts).
 * Używa vi.useFakeTimers do kontroli bieżącego roku.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { weekNumberToDateRange } from "../week-utils";

describe("weekNumberToDateRange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Poprawne formaty
  // -------------------------------------------------------------------------

  describe("poprawne formaty", () => {
    it('"07" → tydzień 7 bieżącego roku (2026)', () => {
      vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
      const result = weekNumberToDateRange("07");
      expect(result).not.toBeNull();
      expect(result!.dateFrom).toBe("2026-02-09");
      expect(result!.dateTo).toBe("2026-02-15");
    });

    it('"2026-07" → { dateFrom: "2026-02-09", dateTo: "2026-02-15" }', () => {
      const result = weekNumberToDateRange("2026-07");
      expect(result).toEqual({
        dateFrom: "2026-02-09",
        dateTo: "2026-02-15",
      });
    });

    it('"2026W07" (bez myślnika, z W) → ten sam wynik co "2026-07"', () => {
      const result = weekNumberToDateRange("2026W07");
      expect(result).toEqual({
        dateFrom: "2026-02-09",
        dateTo: "2026-02-15",
      });
    });

    it('"2026-W07" (myślnik + W) → null (regex obsługuje tylko 1 separator)', () => {
      expect(weekNumberToDateRange("2026-W07")).toBeNull();
    });

    it('"7" (bez leading zero) → działa', () => {
      vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
      const result = weekNumberToDateRange("7");
      expect(result).not.toBeNull();
      expect(result!.dateFrom).toBe("2026-02-09");
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe("edge cases", () => {
    it("tydzień 1 roku 2026 → pon 29.12.2025 – nie 04.01.2026", () => {
      const result = weekNumberToDateRange("2026-01");
      expect(result).not.toBeNull();
      expect(result!.dateFrom).toBe("2025-12-29");
      expect(result!.dateTo).toBe("2026-01-04");
    });

    it("tydzień 53 roku 2020 → poprawny zakres", () => {
      const result = weekNumberToDateRange("2020-53");
      expect(result).not.toBeNull();
      // 2020 ma tydzień 53: pon 28.12.2020 – nie 03.01.2021
      expect(result!.dateFrom).toBe("2020-12-28");
      expect(result!.dateTo).toBe("2021-01-03");
    });

    it("tydzień 0 → null", () => {
      expect(weekNumberToDateRange("0")).toBeNull();
    });

    it("tydzień 54 → null", () => {
      expect(weekNumberToDateRange("54")).toBeNull();
    });

    it("pusty string → null", () => {
      expect(weekNumberToDateRange("")).toBeNull();
    });

    it('spacje "  07  " → trimuje i działa', () => {
      vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
      const result = weekNumberToDateRange("  07  ");
      expect(result).not.toBeNull();
      expect(result!.dateFrom).toBe("2026-02-09");
    });
  });

  // -------------------------------------------------------------------------
  // Niepoprawne wejście
  // -------------------------------------------------------------------------

  describe("niepoprawne wejście", () => {
    it('"abc" → null', () => {
      expect(weekNumberToDateRange("abc")).toBeNull();
    });

    it("sam separator → null", () => {
      expect(weekNumberToDateRange("-")).toBeNull();
    });
  });
});
