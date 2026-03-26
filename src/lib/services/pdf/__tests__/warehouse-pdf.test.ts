// Testy modułu generowania PDF raportu magazynowego
// M-08: warehouse-pdf-generator.service (integracja)

import { describe, it, expect } from "vitest";
import {
  generateWarehouseReportPdf,
  type GenerateWarehouseReportInput,
} from "../warehouse-pdf-generator.service";
import type {
  WarehouseWeekResponseDto,
  WarehouseOrderEntryDto,
  WarehouseDayDto,
} from "../../../../types";

// ---------------------------------------------------------------------------
// Fabryki danych testowych
// ---------------------------------------------------------------------------

/** Minimalny entry z wymaganymi polami */
function makeMinimalEntry(overrides?: Partial<WarehouseOrderEntryDto>): WarehouseOrderEntryDto {
  return {
    orderId: "00000000-0000-0000-0000-000000000001",
    orderNo: "ZT/2026/001",
    stopType: "LOADING",
    timeLocal: "08:00",
    isWeekend: false,
    originalDate: null,
    items: [],
    totalWeightTons: null,
    carrierName: null,
    vehicleType: null,
    notificationDetails: null,
    ...overrides,
  };
}

/** Pełny entry ze wszystkimi polami wypełnionymi */
function makeFullEntry(overrides?: Partial<WarehouseOrderEntryDto>): WarehouseOrderEntryDto {
  return {
    orderId: "00000000-0000-0000-0000-000000000002",
    orderNo: "ZT/2026/042",
    stopType: "LOADING",
    timeLocal: "14:30",
    isWeekend: true,
    originalDate: "2026-03-14",
    items: [
      { productName: "Odpady PET", loadingMethod: "PALETA", weightTons: 12.5 },
      { productName: "Odpady HDPE", loadingMethod: "LUZEM", weightTons: 8.0 },
    ],
    totalWeightTons: 20.5,
    carrierName: "Trans-Pol Sp. z o.o.",
    vehicleType: "CIĘŻARÓWKA",
    notificationDetails: "Awizacja telefoniczna +48 123 456 789",
    ...overrides,
  };
}

/** Dane jednego dnia */
function makeDay(overrides?: Partial<WarehouseDayDto>): WarehouseDayDto {
  return {
    date: "2026-03-10",
    dayName: "Poniedziałek",
    entries: [makeMinimalEntry()],
    ...overrides,
  };
}

/** Bazowe dane tygodnia z domyślnym podsumowaniem */
function makeWeekData(overrides?: Partial<WarehouseWeekResponseDto>): WarehouseWeekResponseDto {
  return {
    week: 11,
    year: 2026,
    weekStart: "2026-03-09",
    weekEnd: "2026-03-13",
    locationName: "Łódź Główna",
    days: [makeDay()],
    noDateEntries: [],
    summary: {
      loadingCount: 1,
      loadingTotalTons: 12.5,
      unloadingCount: 0,
      unloadingTotalTons: 0,
    },
    ...overrides,
  };
}

// ===========================================================================
// Testy integracyjne generateWarehouseReportPdf
// ===========================================================================

describe("generateWarehouseReportPdf", () => {
  it("generates PDF ArrayBuffer with minimal input (1 day, 1 entry)", () => {
    // Arrange — minimalny input: 1 dzień z 1 wpisem
    const input: GenerateWarehouseReportInput = {
      data: makeWeekData(),
    };

    // Act
    const result = generateWarehouseReportPdf(input);

    // Assert — wynik jest ArrayBuffer o sensownym rozmiarze z nagłówkiem %PDF-
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(100);

    const bytes = new Uint8Array(result);
    const header = String.fromCharCode(...bytes.slice(0, 5));
    expect(header).toBe("%PDF-");
  });

  it("generates PDF with full data (multiple days, entries, noDateEntries)", () => {
    // Arrange — pełne dane: 3 dni z wieloma wpisami + wpisy bez daty
    const input: GenerateWarehouseReportInput = {
      data: makeWeekData({
        days: [
          makeDay({
            date: "2026-03-09",
            dayName: "Poniedziałek",
            entries: [makeFullEntry(), makeMinimalEntry({ stopType: "UNLOADING" })],
          }),
          makeDay({
            date: "2026-03-10",
            dayName: "Wtorek",
            entries: [makeFullEntry({ orderNo: "ZT/2026/043" })],
          }),
          makeDay({
            date: "2026-03-11",
            dayName: "Środa",
            entries: [
              makeMinimalEntry({ orderNo: "ZT/2026/044" }),
              makeFullEntry({ orderNo: "ZT/2026/045", stopType: "UNLOADING" }),
            ],
          }),
        ],
        noDateEntries: [
          makeMinimalEntry({ orderNo: "ZT/2026/099" }),
          makeFullEntry({ orderNo: "ZT/2026/100", stopType: "UNLOADING" }),
        ],
        summary: {
          loadingCount: 5,
          loadingTotalTons: 102.5,
          unloadingCount: 3,
          unloadingTotalTons: 45.0,
        },
      }),
    };

    // Act
    const result = generateWarehouseReportPdf(input);

    // Assert — nie rzucił wyjątku, generuje prawidłowy ArrayBuffer
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(100);
  });

  it("generates valid PDF with empty lists (days: [], noDateEntries: [])", () => {
    // Arrange — puste listy: brak dni, brak wpisów bez daty
    const input: GenerateWarehouseReportInput = {
      data: makeWeekData({
        days: [],
        noDateEntries: [],
        summary: {
          loadingCount: 0,
          loadingTotalTons: 0,
          unloadingCount: 0,
          unloadingTotalTons: 0,
        },
      }),
    };

    // Act — nie powinno rzucić wyjątku
    const result = generateWarehouseReportPdf(input);

    // Assert — generuje poprawny PDF nawet bez danych
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(100);

    const bytes = new Uint8Array(result);
    const header = String.fromCharCode(...bytes.slice(0, 5));
    expect(header).toBe("%PDF-");
  });

  it("handles large dataset (20 entries) without crashing", () => {
    // Arrange — 20 wpisów rozłożonych na kilka dni
    const manyEntries: WarehouseOrderEntryDto[] = [];
    for (let i = 0; i < 20; i++) {
      manyEntries.push(
        makeFullEntry({
          orderId: `00000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
          orderNo: `ZT/2026/${String(i + 1).padStart(3, "0")}`,
          stopType: i % 2 === 0 ? "LOADING" : "UNLOADING",
          timeLocal: `${String(8 + (i % 10)).padStart(2, "0")}:00`,
          carrierName: `Firma Transportowa ${i + 1} Sp. z o.o.`,
          notificationDetails: `Awizacja nr ${i + 1}: kontakt telefoniczny wymagany`,
        })
      );
    }

    const input: GenerateWarehouseReportInput = {
      data: makeWeekData({
        days: [
          makeDay({
            date: "2026-03-09",
            dayName: "Poniedziałek",
            entries: manyEntries.slice(0, 7),
          }),
          makeDay({
            date: "2026-03-10",
            dayName: "Wtorek",
            entries: manyEntries.slice(7, 14),
          }),
          makeDay({
            date: "2026-03-11",
            dayName: "Środa",
            entries: manyEntries.slice(14),
          }),
        ],
        summary: {
          loadingCount: 10,
          loadingTotalTons: 125.0,
          unloadingCount: 10,
          unloadingTotalTons: 80.0,
        },
      }),
    };

    // Act
    const result = generateWarehouseReportPdf(input);

    // Assert — nie rzucił wyjątku, rozmiar > 100 bytes
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(100);
  });

  it("handles day with empty entries (skipped in output)", () => {
    // Arrange — dzień z pustą listą entries (powinien być pominięty)
    const input: GenerateWarehouseReportInput = {
      data: makeWeekData({
        days: [
          makeDay({ entries: [] }), // pusty dzień — pominięty
          makeDay({ date: "2026-03-10", dayName: "Wtorek", entries: [makeMinimalEntry()] }),
        ],
      }),
    };

    // Act
    const result = generateWarehouseReportPdf(input);

    // Assert
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(100);
  });

  it("handles entries with weekend flag", () => {
    // Arrange — wpis z flagą isWeekend (wyświetla czas z gwiazdką)
    const input: GenerateWarehouseReportInput = {
      data: makeWeekData({
        days: [
          makeDay({
            entries: [
              makeMinimalEntry({ isWeekend: true, originalDate: "2026-03-14", timeLocal: "10:00" }),
            ],
          }),
        ],
      }),
    };

    // Act
    const result = generateWarehouseReportPdf(input);

    // Assert
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(100);
  });
});
