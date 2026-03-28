/**
 * Testy funkcji formatowania dat/czasu (format-utils.ts).
 * Pure functions — zero mocków.
 */

import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatDateShort,
  formatDateFromTimestamp,
  formatDateTimeFromTimestamp,
  formatTime,
  formatDateTime,
  formatDateTimeShort,
  shortenName,
} from "../format-utils";

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe("formatDate", () => {
  it('formatuje "2026-02-17" → "17.02.2026"', () => {
    expect(formatDate("2026-02-17")).toBe("17.02.2026");
  });

  it("null → em dash", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("undefined → em dash", () => {
    expect(formatDate(undefined)).toBe("—");
  });

  it("niepełna data (za mało części) → passthrough", () => {
    expect(formatDate("2026-02")).toBe("2026-02");
  });

  it("pusty string → em dash", () => {
    expect(formatDate("")).toBe("—");
  });
});

// ---------------------------------------------------------------------------
// formatDateShort
// ---------------------------------------------------------------------------

describe("formatDateShort", () => {
  it('formatuje "2026-02-17" → "17.02"', () => {
    expect(formatDateShort("2026-02-17")).toBe("17.02");
  });

  it("null → em dash", () => {
    expect(formatDateShort(null)).toBe("—");
  });

  it("undefined → em dash", () => {
    expect(formatDateShort(undefined)).toBe("—");
  });
});

// ---------------------------------------------------------------------------
// formatDateFromTimestamp
// ---------------------------------------------------------------------------

describe("formatDateFromTimestamp", () => {
  it('timestamp ISO → "17.02.2026"', () => {
    expect(formatDateFromTimestamp("2026-02-17T14:32:01.000Z")).toBe("17.02.2026");
  });

  it("null → em dash", () => {
    expect(formatDateFromTimestamp(null)).toBe("—");
  });

  it("timestamp bez części czasowej → formatuje jako datę", () => {
    expect(formatDateFromTimestamp("2026-02-17")).toBe("17.02.2026");
  });
});

// ---------------------------------------------------------------------------
// formatDateTimeFromTimestamp
// ---------------------------------------------------------------------------

describe("formatDateTimeFromTimestamp", () => {
  it('timestamp ISO → "17.02.2026 14:32"', () => {
    expect(formatDateTimeFromTimestamp("2026-02-17T14:32:01.000Z")).toBe("17.02.2026 14:32");
  });

  it("null → em dash", () => {
    expect(formatDateTimeFromTimestamp(null)).toBe("—");
  });

  it("undefined → em dash", () => {
    expect(formatDateTimeFromTimestamp(undefined)).toBe("—");
  });

  it("timestamp bez części czasowej → tylko data", () => {
    expect(formatDateTimeFromTimestamp("2026-02-17")).toBe("17.02.2026");
  });

  it("pusty string → em dash", () => {
    expect(formatDateTimeFromTimestamp("")).toBe("—");
  });
});

// ---------------------------------------------------------------------------
// formatTime
// ---------------------------------------------------------------------------

describe("formatTime", () => {
  it('"14:32:00" → "14:32"', () => {
    expect(formatTime("14:32:00")).toBe("14:32");
  });

  it('"14:32" → "14:32" (już krótki)', () => {
    expect(formatTime("14:32")).toBe("14:32");
  });

  it("null → pusty string", () => {
    expect(formatTime(null)).toBe("");
  });

  it("undefined → pusty string", () => {
    expect(formatTime(undefined)).toBe("");
  });

  it("krótszy niż 5 zn → passthrough", () => {
    expect(formatTime("8:00")).toBe("8:00");
  });
});

// ---------------------------------------------------------------------------
// formatDateTime
// ---------------------------------------------------------------------------

describe("formatDateTime", () => {
  it('data + czas → "17.02.2026 14:32"', () => {
    expect(formatDateTime("2026-02-17", "14:32:00")).toBe("17.02.2026 14:32");
  });

  it("data + null czas → tylko data", () => {
    expect(formatDateTime("2026-02-17", null)).toBe("17.02.2026");
  });

  it("null data + czas → em dash", () => {
    expect(formatDateTime(null, "14:32")).toBe("—");
  });

  it("null + null → em dash", () => {
    expect(formatDateTime(null, null)).toBe("—");
  });
});

// ---------------------------------------------------------------------------
// formatDateTimeShort
// ---------------------------------------------------------------------------

describe("formatDateTimeShort", () => {
  it('data + czas → "17.02 14:32"', () => {
    expect(formatDateTimeShort("2026-02-17", "14:32:00")).toBe("17.02 14:32");
  });

  it("null + null → em dash", () => {
    expect(formatDateTimeShort(null, null)).toBe("—");
  });

  it("data + null czas → tylko krótka data", () => {
    expect(formatDateTimeShort("2026-02-17", null)).toBe("17.02");
  });
});

// ---------------------------------------------------------------------------
// shortenName
// ---------------------------------------------------------------------------

describe("shortenName", () => {
  it('"NordMetal Recycling" → "NordMetal"', () => {
    expect(shortenName("NordMetal Recycling")).toBe("NordMetal");
  });

  it('"ABC-Dluganazwa" → "ABC" (split po myślniku)', () => {
    expect(shortenName("ABC-Dluganazwa")).toBe("ABC");
  });

  it("null → ?", () => {
    expect(shortenName(null)).toBe("?");
  });

  it("undefined → ?", () => {
    expect(shortenName(undefined)).toBe("?");
  });

  it("15-znakowe słowo → obcięte do 10", () => {
    expect(shortenName("Abcdefghijklmno")).toBe("Abcdefghij");
  });

  it("jedno krótkie słowo → bez zmian", () => {
    expect(shortenName("Test")).toBe("Test");
  });
});
