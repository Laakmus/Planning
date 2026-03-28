/**
 * Testy dla getCurrentISOWeek (src/lib/services/warehouse.service.ts).
 *
 * Pokrycie:
 * - Typowe daty w środku roku
 * - Początek roku (4 stycznia w tygodniu 1)
 * - Koniec roku — tydzień ISO przechodzący na nowy rok (2025-12-29 → W01 2026)
 * - Koniec roku — ostatni tydzień starego roku (2025-12-28 → W52 2025)
 * - Granica lat: 2024-12-30 → W01 2025
 */

import { describe, it, expect } from "vitest";

import { getCurrentISOWeek } from "../warehouse.service";

// ---------------------------------------------------------------------------
// Testy
// ---------------------------------------------------------------------------

describe("getCurrentISOWeek", () => {
  it("returns week=2, year=2026 for 2026-01-05 (Monday of week 2)", () => {
    // Poniedziałek drugiego tygodnia 2026
    const result = getCurrentISOWeek(new Date(2026, 0, 5));

    expect(result).toEqual({ week: 2, year: 2026 });
  });

  it("returns week=1, year=2026 for 2026-01-01 (Thursday, first week of 2026)", () => {
    // 1 stycznia 2026 to czwartek — tydzień ISO 1
    const result = getCurrentISOWeek(new Date(2026, 0, 1));

    expect(result).toEqual({ week: 1, year: 2026 });
  });

  it("returns week=1, year=2026 for 2025-12-29 (Monday — ISO week crosses into 2026)", () => {
    // 29 grudnia 2025 (poniedziałek) — czwartek tego tygodnia to 1 stycznia 2026,
    // więc tydzień ISO = 1, rok ISO = 2026
    const result = getCurrentISOWeek(new Date(2025, 11, 29));

    expect(result).toEqual({ week: 1, year: 2026 });
  });

  it("returns week=52, year=2025 for 2025-12-28 (Sunday — last day of week 52)", () => {
    // 28 grudnia 2025 (niedziela) — ostatni dzień tygodnia ISO 52 roku 2025
    const result = getCurrentISOWeek(new Date(2025, 11, 28));

    expect(result).toEqual({ week: 52, year: 2025 });
  });

  it("returns week=25, year=2026 for 2026-06-15 (mid-year date)", () => {
    // Typowa data w środku roku
    const result = getCurrentISOWeek(new Date(2026, 5, 15));

    expect(result).toEqual({ week: 25, year: 2026 });
  });

  it("returns week=1, year=2025 for 2024-12-30 (Monday — ISO week crosses into 2025)", () => {
    // 30 grudnia 2024 (poniedziałek) — czwartek tego tygodnia to 2 stycznia 2025,
    // więc tydzień ISO = 1, rok ISO = 2025
    const result = getCurrentISOWeek(new Date(2024, 11, 30));

    expect(result).toEqual({ week: 1, year: 2025 });
  });
});
