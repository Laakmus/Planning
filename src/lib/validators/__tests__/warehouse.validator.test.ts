/**
 * Testy dla warehouseQuerySchema (src/lib/validators/order.validator.ts).
 *
 * Pokrycie:
 * - Prawidłowe parametry (typowe wartości, granice)
 * - Coerce — stringi konwertowane na liczby
 * - Nieprawidłowy tydzień (za mały, za duży)
 * - Nieprawidłowy rok (za mały, za duży)
 * - Brakujące pola (week, year)
 * - Stringi nie-numeryczne
 */

import { describe, it, expect } from "vitest";

import { warehouseQuerySchema } from "../order.validator";

// ---------------------------------------------------------------------------
// Testy — prawidłowe dane
// ---------------------------------------------------------------------------

describe("warehouseQuerySchema — valid inputs", () => {
  it("accepts { week: 1, year: 2026 }", () => {
    const result = warehouseQuerySchema.safeParse({ week: 1, year: 2026 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ week: 1, year: 2026 });
    }
  });

  it("accepts { week: 53, year: 2099 } (upper bounds)", () => {
    // Granice maksymalne — tydzień 53, rok 2099
    const result = warehouseQuerySchema.safeParse({ week: 53, year: 2099 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ week: 53, year: 2099 });
    }
  });

  it("coerces string values to numbers: { week: '12', year: '2026' }", () => {
    // z.coerce.number() powinien konwertować stringi na liczby
    const result = warehouseQuerySchema.safeParse({ week: "12", year: "2026" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ week: 12, year: 2026 });
    }
  });
});

// ---------------------------------------------------------------------------
// Testy — nieprawidłowy tydzień
// ---------------------------------------------------------------------------

describe("warehouseQuerySchema — invalid week", () => {
  it("rejects week=0 (below minimum 1)", () => {
    const result = warehouseQuerySchema.safeParse({ week: 0, year: 2026 });

    expect(result.success).toBe(false);
  });

  it("rejects week=54 (above maximum 53)", () => {
    const result = warehouseQuerySchema.safeParse({ week: 54, year: 2026 });

    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Testy — nieprawidłowy rok
// ---------------------------------------------------------------------------

describe("warehouseQuerySchema — invalid year", () => {
  it("rejects year=2019 (below minimum 2020)", () => {
    const result = warehouseQuerySchema.safeParse({ week: 12, year: 2019 });

    expect(result.success).toBe(false);
  });

  it("rejects year=2100 (above maximum 2099)", () => {
    const result = warehouseQuerySchema.safeParse({ week: 12, year: 2100 });

    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Testy — brakujące pola
// ---------------------------------------------------------------------------

describe("warehouseQuerySchema — missing fields", () => {
  it("rejects when week is missing", () => {
    const result = warehouseQuerySchema.safeParse({ year: 2026 });

    expect(result.success).toBe(false);
  });

  it("rejects when year is missing", () => {
    const result = warehouseQuerySchema.safeParse({ week: 12 });

    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Testy — stringi nie-numeryczne
// ---------------------------------------------------------------------------

describe("warehouseQuerySchema — non-numeric strings", () => {
  it("rejects non-numeric week string", () => {
    // "abc" nie jest konwertowalne na liczbę → NaN → nie przejdzie int()/min()
    const result = warehouseQuerySchema.safeParse({ week: "abc", year: "2026" });

    expect(result.success).toBe(false);
  });
});
