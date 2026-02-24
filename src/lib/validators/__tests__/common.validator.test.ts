/**
 * Testy schematów Zod z common.validator.ts.
 * Pure validation — zero mocków.
 */

import { describe, it, expect } from "vitest";
import { uuidSchema, paginationSchema, isoDateSchema, isoTimeSchema } from "../common.validator";
import { ZodError } from "zod";

// ---------------------------------------------------------------------------
// uuidSchema
// ---------------------------------------------------------------------------

describe("uuidSchema", () => {
  it("poprawny UUID → parse OK", () => {
    const result = uuidSchema.parse("a0000000-0000-0000-0000-000000000001");
    expect(result).toBe("a0000000-0000-0000-0000-000000000001");
  });

  it('"not-uuid" → ZodError', () => {
    expect(() => uuidSchema.parse("not-uuid")).toThrow(ZodError);
  });

  it("pusty string → ZodError", () => {
    expect(() => uuidSchema.parse("")).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// paginationSchema
// ---------------------------------------------------------------------------

describe("paginationSchema", () => {
  it("{} → domyślne { page: 1, pageSize: 50 }", () => {
    const result = paginationSchema.parse({});
    expect(result).toEqual({ page: 1, pageSize: 50 });
  });

  it('{ page: "3", pageSize: "100" } → coerce OK', () => {
    const result = paginationSchema.parse({ page: "3", pageSize: "100" });
    expect(result).toEqual({ page: 3, pageSize: 100 });
  });

  it("{ page: 0 } → ZodError (min 1)", () => {
    expect(() => paginationSchema.parse({ page: 0 })).toThrow(ZodError);
  });

  it("{ pageSize: 201 } → ZodError (max 200)", () => {
    expect(() => paginationSchema.parse({ pageSize: 201 })).toThrow(ZodError);
  });

  it("{ pageSize: 0 } → ZodError (min 1)", () => {
    expect(() => paginationSchema.parse({ pageSize: 0 })).toThrow(ZodError);
  });

  it("{ page: 1.5 } → ZodError (int)", () => {
    expect(() => paginationSchema.parse({ page: 1.5 })).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// isoDateSchema
// ---------------------------------------------------------------------------

describe("isoDateSchema", () => {
  it('"2026-02-17" → OK', () => {
    expect(isoDateSchema.parse("2026-02-17")).toBe("2026-02-17");
  });

  it('"2026-2-17" → ZodError (brak leading zero)', () => {
    expect(() => isoDateSchema.parse("2026-2-17")).toThrow(ZodError);
  });

  it('"17.02.2026" → ZodError (polski format)', () => {
    expect(() => isoDateSchema.parse("17.02.2026")).toThrow(ZodError);
  });

  it('"abc" → ZodError', () => {
    expect(() => isoDateSchema.parse("abc")).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// isoTimeSchema
// ---------------------------------------------------------------------------

describe("isoTimeSchema", () => {
  it('"14:32" → OK', () => {
    expect(isoTimeSchema.parse("14:32")).toBe("14:32");
  });

  it('"14:32:00" → OK (sekundy opcjonalne)', () => {
    expect(isoTimeSchema.parse("14:32:00")).toBe("14:32:00");
  });

  it('"2:32" → ZodError (brak leading zero)', () => {
    expect(() => isoTimeSchema.parse("2:32")).toThrow(ZodError);
  });

  it('"25:00" → OK (regex nie waliduje zakresu godzin)', () => {
    // Regex: /^\d{2}:\d{2}(:\d{2})?$/ — dopuszcza 25:00
    expect(isoTimeSchema.parse("25:00")).toBe("25:00");
  });
});
