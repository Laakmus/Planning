/**
 * Testy weekNumberToDateRange (week-utils.ts).
 * Używa vi.useFakeTimers do kontroli bieżącego roku.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  addDaysUTC,
  formatUTCDate,
  getCurrentISOWeek,
  getISOWeekMonday,
  getISOWeekOfDate,
  weekNumberToDateRange,
} from "../week-utils";

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

    it('"2026-W07" (myślnik + W, format ISO 8601) → tydzień 7 roku 2026', () => {
      expect(weekNumberToDateRange("2026-W07")).toEqual({
        dateFrom: "2026-02-09",
        dateTo: "2026-02-15",
      });
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

describe("helpery tygodni ISO", () => {
  it("getISOWeekMonday zwraca poniedziałek tygodnia 1 (także w grudniu poprzedniego roku)", () => {
    expect(formatUTCDate(getISOWeekMonday(2026, 1))).toBe("2025-12-29");
    expect(formatUTCDate(getISOWeekMonday(2026, 40))).toBe("2026-09-28");
  });

  it("getISOWeekOfDate — granica lat", () => {
    expect(getISOWeekOfDate(new Date(Date.UTC(2024, 11, 30)))).toEqual({ week: 1, year: 2025 });
    expect(getISOWeekOfDate(new Date(Date.UTC(2021, 0, 3)))).toEqual({ week: 53, year: 2020 });
  });

  it("getCurrentISOWeek liczy „dziś” w Europe/Warsaw (pon 00:30 CEST = nd 22:30 UTC)", () => {
    expect(getCurrentISOWeek(new Date("2026-09-27T22:30:00Z"))).toEqual({ week: 40, year: 2026 });
    expect(getCurrentISOWeek(new Date("2026-09-27T21:30:00Z"))).toEqual({ week: 39, year: 2026 });
  });

  it("addDaysUTC nie zależy od zmiany czasu (DST)", () => {
    expect(formatUTCDate(addDaysUTC(new Date(Date.UTC(2026, 9, 24)), 2))).toBe("2026-10-26");
  });
});
