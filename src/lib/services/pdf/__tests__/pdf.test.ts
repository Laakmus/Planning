// Testy modułu generowania PDF zlecenia transportowego
// M-17: pdf-layout (stałe), pdf-generator.service (integracja), pdf-sections (helpery)

import { describe, it, expect } from "vitest";
import {
  generateOrderPdf,
  type GeneratePdfInput,
} from "../pdf-generator.service";
import { checkPageBreak } from "../pdf-sections";
import { jsPDF } from "jspdf";
import * as L from "../pdf-layout";

// ---------------------------------------------------------------------------
// Fabryki danych testowych
// ---------------------------------------------------------------------------

/** Minimalny order z wymaganymi polami */
function makeMinimalOrder(): GeneratePdfInput["order"] {
  return {
    orderNo: "ZT/2026/001",
    createdAt: "2026-01-15T10:30:00Z",
    carrierName: null,
    carrierAddress: null,
    carrierTaxId: null,
    vehicleType: null,
    vehicleVolumeM3: null,
    priceAmount: null,
    currencyCode: null,
    paymentTermDays: null,
    paymentMethod: null,
    documentsText: null,
    generalNotes: null,
    confidentialityClause: null,
    senderContactName: null,
    senderContactEmail: null,
    senderContactPhone: null,
  };
}

/** Pełny order ze wszystkimi polami wypełnionymi */
function makeFullOrder(): GeneratePdfInput["order"] {
  return {
    orderNo: "ZT/2026/042",
    createdAt: "2026-03-07T14:22:00Z",
    carrierName: "Trans-Pol Sp. z o.o.",
    carrierAddress: "ul. Transportowa 15, 00-100 Warszawa",
    carrierTaxId: "1234567890",
    vehicleType: "CIĘŻARÓWKA",
    vehicleVolumeM3: 90,
    priceAmount: 4500,
    currencyCode: "EUR",
    paymentTermDays: 30,
    paymentMethod: "przelew",
    documentsText: "WZE, CMR, Aneks VII",
    generalNotes: "Towar delikatny — unikać wstrząsów.",
    confidentialityClause: "Niestandardowa klauzula poufności dla testu.",
    senderContactName: "Jan Kowalski",
    senderContactEmail: "jan@odylion.pl",
    senderContactPhone: "+48 123 456 789",
  };
}

/** Przykładowe przystanki */
function makeStops(): GeneratePdfInput["stops"] {
  return [
    {
      kind: "LOADING",
      sequenceNo: 1,
      dateLocal: "2026-03-10",
      timeLocal: "08:00",
      companyNameSnapshot: "Producent SA",
      addressSnapshot: "ul. Fabryczna 1, Łódź",
      locationNameSnapshot: "Magazyn Łódź",
      country: "PL",
    },
    {
      kind: "UNLOADING",
      sequenceNo: 2,
      dateLocal: "2026-03-12",
      timeLocal: "14:30",
      companyNameSnapshot: "Odbiorca GmbH",
      addressSnapshot: "Industriestraße 5, Berlin",
      locationNameSnapshot: "Lager Berlin",
      country: "DE",
    },
  ];
}

/** Przykładowe towary */
function makeItems(): GeneratePdfInput["items"] {
  return [
    {
      productNameSnapshot: "Odpady PET",
      loadingMethodCode: "PALETA",
      notes: "20 palet",
    },
    {
      productNameSnapshot: "Odpady HDPE",
      loadingMethodCode: "LUZEM",
      notes: null,
    },
  ];
}

// ===========================================================================
// 1. pdf-layout.ts — stałe
// ===========================================================================

describe("pdf-layout constants", () => {
  // --- Wymiary strony A4 ---
  it("PAGE_WIDTH_MM equals 210 (A4 width)", () => {
    expect(L.PAGE_WIDTH_MM).toBe(210);
  });

  it("PAGE_HEIGHT_MM equals 297 (A4 height)", () => {
    expect(L.PAGE_HEIGHT_MM).toBe(297);
  });

  // --- Współczynnik PX ---
  it("PX conversion factor is approximately 0.353", () => {
    expect(L.PX).toBeCloseTo(210 / 595, 4);
  });

  // --- Marginesy ---
  it("margins are positive and less than half the page", () => {
    expect(L.MARGIN_LEFT).toBeGreaterThan(0);
    expect(L.MARGIN_LEFT).toBeLessThan(L.PAGE_WIDTH_MM / 2);
    expect(L.MARGIN_TOP).toBeGreaterThan(0);
    expect(L.MARGIN_TOP).toBeLessThan(L.PAGE_HEIGHT_MM / 2);
    expect(L.MARGIN_BOTTOM).toBeGreaterThan(0);
    expect(L.MARGIN_BOTTOM).toBeLessThan(L.PAGE_HEIGHT_MM / 2);
  });

  // --- Szerokości wierszy ---
  it("ROW_W is wider than ROW_NARROW_W", () => {
    expect(L.ROW_W).toBeGreaterThan(L.ROW_NARROW_W);
  });

  it("ROW_W fits within page width minus margins", () => {
    // Szerokość wiersza + margines lewy nie powinny przekraczać szerokości strony
    expect(L.MARGIN_LEFT + L.ROW_W).toBeLessThanOrEqual(L.PAGE_WIDTH_MM);
  });

  // --- Kolory w formacie hex ---
  it("all colors are valid hex format (#RRGGBB)", () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    const colors = [
      L.COLOR_BLACK,
      L.COLOR_WHITE,
      L.COLOR_LABEL_BG,
      L.COLOR_GRAY,
      L.COLOR_GRAY2,
      L.COLOR_ORANGE,
      L.COLOR_ORANGE_LIGHT,
      L.COLOR_LOADING_BG,
    ];
    for (const color of colors) {
      expect(color).toMatch(hexPattern);
    }
  });

  // --- Konkretne wartości kolorów ---
  it("COLOR_BLACK is #000000 and COLOR_WHITE is #FFFFFF", () => {
    expect(L.COLOR_BLACK).toBe("#000000");
    expect(L.COLOR_WHITE).toBe("#FFFFFF");
  });

  // --- Rozmiary fontów ---
  it("font sizes are positive numbers in ascending order", () => {
    const sizes = [L.FONT_5, L.FONT_6, L.FONT_6_5, L.FONT_7, L.FONT_8, L.FONT_9, L.FONT_9_5];
    for (let i = 0; i < sizes.length; i++) {
      expect(sizes[i]).toBeGreaterThan(0);
      if (i > 0) {
        expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
      }
    }
  });

  // --- Wysokości wierszy ---
  it("all row heights are positive", () => {
    const heights = [L.H_23, L.H_24, L.H_26, L.H_17, L.H_30, L.H_20, L.H_46, L.H_64, L.H_31, L.H_15, L.H_12];
    for (const h of heights) {
      expect(h).toBeGreaterThan(0);
    }
  });

  // --- Grubość linii ---
  it("LINE_W is small positive value (< 1mm)", () => {
    expect(L.LINE_W).toBeGreaterThan(0);
    expect(L.LINE_W).toBeLessThan(1);
  });

  // --- Minimalna liczba wierszy towarów ---
  it("MIN_ITEM_ROWS equals 8", () => {
    expect(L.MIN_ITEM_ROWS).toBe(8);
  });

  // --- Kolumny items sumują się do ROW_W minus LABEL_W ---
  it("item columns width equals ROW_W minus LABEL_W (full row minus label)", () => {
    // Nagłówek asortymentu używa LABEL_W + reszta kolumn
    // Wiersze towarów: COL_ITEM_NAME_W + COL_ITEM_NOTES_W + packaging columns
    const itemRowW =
      L.COL_ITEM_NAME_W + L.COL_ITEM_NOTES_W + L.COL_LUZEM_W + L.COL_BIGBAG_W + L.COL_PALETA_W + L.COL_INNA_W;
    // Szerokość wiersza towarów powinna być bliska ROW_W (może nie idealnie z powodu zaokrągleń PX)
    expect(itemRowW).toBeCloseTo(L.ROW_W, 0);
  });
});

// ===========================================================================
// 2. pdf-generator.service.ts — testy integracyjne
// ===========================================================================

describe("generateOrderPdf", () => {
  it("generates PDF ArrayBuffer with minimal input (no stops, no items)", () => {
    // Arrange — minimalny order, puste tablice
    const input: GeneratePdfInput = {
      order: makeMinimalOrder(),
      stops: [],
      items: [],
    };

    // Act
    const result = generateOrderPdf(input);

    // Assert — wynik jest ArrayBuffer o sensownym rozmiarze
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(100);
  });

  it("generates PDF ArrayBuffer with full input (order + 2 stops + 2 items)", () => {
    // Arrange — pełny order z przystankami i towarami
    const input: GeneratePdfInput = {
      order: makeFullOrder(),
      stops: makeStops(),
      items: makeItems(),
    };

    // Act
    const result = generateOrderPdf(input);

    // Assert
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(100);
  });

  it("full PDF is larger than minimal PDF", () => {
    // Arrange
    const minimalInput: GeneratePdfInput = {
      order: makeMinimalOrder(),
      stops: [],
      items: [],
    };
    const fullInput: GeneratePdfInput = {
      order: makeFullOrder(),
      stops: makeStops(),
      items: makeItems(),
    };

    // Act
    const minResult = generateOrderPdf(minimalInput);
    const fullResult = generateOrderPdf(fullInput);

    // Assert — pełny PDF powinien być większy (więcej treści)
    expect(fullResult.byteLength).toBeGreaterThan(minResult.byteLength);
  });

  it("PDF starts with valid PDF header (%PDF-)", () => {
    // Arrange
    const input: GeneratePdfInput = {
      order: makeMinimalOrder(),
      stops: [],
      items: [],
    };

    // Act
    const result = generateOrderPdf(input);
    const bytes = new Uint8Array(result);
    const header = String.fromCharCode(...bytes.slice(0, 5));

    // Assert — nagłówek PDF zaczyna się od %PDF-
    expect(header).toBe("%PDF-");
  });

  it("handles many stops without crashing (page break test)", () => {
    // Arrange — 10 przystanków wymuszających łamanie strony
    const manyStops: GeneratePdfInput["stops"] = [];
    for (let i = 0; i < 10; i++) {
      manyStops.push({
        kind: i % 2 === 0 ? "LOADING" : "UNLOADING",
        sequenceNo: i + 1,
        dateLocal: "2026-04-01",
        timeLocal: "10:00",
        companyNameSnapshot: `Firma ${i + 1}`,
        addressSnapshot: `ul. Testowa ${i + 1}, Miasto`,
        locationNameSnapshot: `Lokalizacja ${i + 1}`,
        country: "PL",
      });
    }

    const input: GeneratePdfInput = {
      order: makeFullOrder(),
      stops: manyStops,
      items: makeItems(),
    };

    // Act
    const result = generateOrderPdf(input);

    // Assert — nie rzucił wyjątku, wynik jest prawidłowy
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(500);
  });

  it("handles many items without crashing (exceeds MIN_ITEM_ROWS)", () => {
    // Arrange — 15 towarów (więcej niż MIN_ITEM_ROWS = 8)
    const manyItems: GeneratePdfInput["items"] = [];
    for (let i = 0; i < 15; i++) {
      manyItems.push({
        productNameSnapshot: `Towar ${i + 1}`,
        loadingMethodCode: ["PALETA", "LUZEM", "PALETA_BIGBAG", "KOSZE"][i % 4],
        notes: i % 3 === 0 ? `Uwaga do towaru ${i + 1}` : null,
      });
    }

    const input: GeneratePdfInput = {
      order: makeMinimalOrder(),
      stops: [],
      items: manyItems,
    };

    // Act
    const result = generateOrderPdf(input);

    // Assert
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(100);
  });

  it("handles all null optional fields in order", () => {
    // Arrange — wszystkie opcjonalne pola ustawione na null
    const input: GeneratePdfInput = {
      order: makeMinimalOrder(), // wszystkie opcjonalne już null
      stops: [],
      items: [],
    };

    // Act — nie powinno rzucić wyjątku
    const result = generateOrderPdf(input);

    // Assert
    expect(result).toBeInstanceOf(ArrayBuffer);
  });

  it("handles stop with all null optional fields", () => {
    // Arrange — przystanek z minimalnymi danymi
    const input: GeneratePdfInput = {
      order: makeMinimalOrder(),
      stops: [
        {
          kind: "LOADING",
          sequenceNo: 1,
          dateLocal: null,
          timeLocal: null,
          companyNameSnapshot: null,
          addressSnapshot: null,
          locationNameSnapshot: null,
          country: null,
        },
      ],
      items: [],
    };

    // Act
    const result = generateOrderPdf(input);

    // Assert
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(100);
  });

  it("handles item with all null optional fields", () => {
    // Arrange — towar z minimalnymi danymi
    const input: GeneratePdfInput = {
      order: makeMinimalOrder(),
      stops: [],
      items: [
        {
          productNameSnapshot: null,
          loadingMethodCode: null,
          notes: null,
        },
      ],
    };

    // Act
    const result = generateOrderPdf(input);

    // Assert
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(100);
  });
});

// ===========================================================================
// 3. pdf-sections.ts — checkPageBreak (jedyna eksportowana funkcja-helper)
// ===========================================================================

describe("checkPageBreak", () => {
  it("returns same Y when content fits on page", () => {
    // Arrange
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const currentY = 100; // na środku strony
    const neededHeight = 50; // dobrze się zmieści

    // Act
    const result = checkPageBreak(doc, currentY, neededHeight);

    // Assert — Y się nie zmienia
    expect(result).toBe(currentY);
  });

  it("adds new page and returns MARGIN_TOP when content does not fit", () => {
    // Arrange
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const currentY = 280; // blisko dołu strony A4 (297mm)
    const neededHeight = 30; // nie zmieści się (280 + 30 > 297 - MARGIN_BOTTOM)

    // Act
    const pagesBefore = doc.getNumberOfPages();
    const result = checkPageBreak(doc, currentY, neededHeight);
    const pagesAfter = doc.getNumberOfPages();

    // Assert — nowa strona, Y = MARGIN_TOP
    expect(result).toBe(L.MARGIN_TOP);
    expect(pagesAfter).toBe(pagesBefore + 1);
  });

  it("does not add page when content barely fits", () => {
    // Arrange
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const maxY = L.PAGE_HEIGHT_MM - L.MARGIN_BOTTOM;
    const neededHeight = 10;
    const currentY = maxY - neededHeight; // dokładnie się zmieści

    // Act
    const pagesBefore = doc.getNumberOfPages();
    const result = checkPageBreak(doc, currentY, neededHeight);
    const pagesAfter = doc.getNumberOfPages();

    // Assert — bez nowej strony
    expect(result).toBe(currentY);
    expect(pagesAfter).toBe(pagesBefore);
  });
});
