/**
 * Testy czystych funkcji z order-snapshot.service.ts:
 * - computeDenormalizedFields
 * - buildSearchText
 * - autoSetDocumentsAndCurrency
 *
 * Funkcje czyste — nie wymagają mocków Supabase.
 */

import { describe, it, expect } from "vitest";

import {
  computeDenormalizedFields,
  buildSearchText,
  autoSetDocumentsAndCurrency,
} from "../order-snapshot.service";

// ---------------------------------------------------------------------------
// computeDenormalizedFields
// ---------------------------------------------------------------------------

describe("computeDenormalizedFields", () => {
  // Helpery do tworzenia danych testowych
  const makeStop = (
    kind: string,
    dateLocal: string | null = null,
    timeLocal: string | null = null,
    locationNameSnapshot: string | null = null,
    country: string | null = null
  ) => ({ kind, dateLocal, timeLocal, locationNameSnapshot, country });

  const makeItem = (productNameSnapshot: string | null = null) => ({
    productNameSnapshot,
  });

  describe("puste dane wejściowe", () => {
    it("empty stops and items → all date fields null, no route, no product", () => {
      const result = computeDenormalizedFields([], []);

      expect(result.first_loading_date).toBeNull();
      expect(result.first_loading_time).toBeNull();
      expect(result.first_unloading_date).toBeNull();
      expect(result.first_unloading_time).toBeNull();
      expect(result.last_loading_date).toBeNull();
      expect(result.last_loading_time).toBeNull();
      expect(result.last_unloading_date).toBeNull();
      expect(result.last_unloading_time).toBeNull();
      expect(result.first_loading_country).toBeNull();
      expect(result.first_unloading_country).toBeNull();
      expect(result.summary_route).toBeNull();
      expect(result.main_product_name).toBeNull();
      // Brak first_loading_date → transport_year = bieżący rok
      expect(result.transport_year).toBe(new Date().getFullYear());
    });
  });

  describe("tylko LOADING stops (brak UNLOADING)", () => {
    it("unloading dates → null, loading dates populated", () => {
      const stops = [
        makeStop("LOADING", "2026-03-01", "08:00", "Magazyn Kęty", "PL"),
        makeStop("LOADING", "2026-03-02", "10:00", "Magazyn Kraków", "PL"),
      ];

      const result = computeDenormalizedFields(stops, []);

      // Loading dates
      expect(result.first_loading_date).toBe("2026-03-01");
      expect(result.first_loading_time).toBe("08:00");
      expect(result.last_loading_date).toBe("2026-03-02");
      expect(result.last_loading_time).toBe("10:00");

      // Unloading dates — null
      expect(result.first_unloading_date).toBeNull();
      expect(result.first_unloading_time).toBeNull();
      expect(result.last_unloading_date).toBeNull();
      expect(result.last_unloading_time).toBeNull();

      // Country
      expect(result.first_loading_country).toBe("PL");
      expect(result.first_unloading_country).toBeNull();
    });
  });

  describe("tylko UNLOADING stops (brak LOADING)", () => {
    it("loading dates → null, unloading dates populated", () => {
      const stops = [
        makeStop("UNLOADING", "2026-03-05", "14:00", "Hamburg Port", "DE"),
      ];

      const result = computeDenormalizedFields(stops, []);

      // Loading — null
      expect(result.first_loading_date).toBeNull();
      expect(result.first_loading_time).toBeNull();
      expect(result.last_loading_date).toBeNull();
      expect(result.last_loading_time).toBeNull();
      expect(result.first_loading_country).toBeNull();

      // Unloading
      expect(result.first_unloading_date).toBe("2026-03-05");
      expect(result.first_unloading_time).toBe("14:00");
      expect(result.last_unloading_date).toBe("2026-03-05");
      expect(result.last_unloading_time).toBe("14:00");
      expect(result.first_unloading_country).toBe("DE");

      // Brak loading → transport_year = bieżący rok
      expect(result.transport_year).toBe(new Date().getFullYear());
    });
  });

  describe("mieszanka LOADING + UNLOADING", () => {
    it("poprawne first/last dates dla obu typów", () => {
      const stops = [
        makeStop("LOADING", "2026-03-01", "08:00", "Kęty", "PL"),
        makeStop("LOADING", "2026-03-02", "09:00", "Kraków", "PL"),
        makeStop("UNLOADING", "2026-03-04", "14:00", "Hamburg", "DE"),
        makeStop("UNLOADING", "2026-03-05", "16:00", "Berlin", "DE"),
      ];

      const result = computeDenormalizedFields(stops, []);

      expect(result.first_loading_date).toBe("2026-03-01");
      expect(result.first_loading_time).toBe("08:00");
      expect(result.last_loading_date).toBe("2026-03-02");
      expect(result.last_loading_time).toBe("09:00");
      expect(result.first_unloading_date).toBe("2026-03-04");
      expect(result.first_unloading_time).toBe("14:00");
      expect(result.last_unloading_date).toBe("2026-03-05");
      expect(result.last_unloading_time).toBe("16:00");
      expect(result.first_loading_country).toBe("PL");
      expect(result.first_unloading_country).toBe("DE");
    });

    it("jeden LOADING + jeden UNLOADING → first === last", () => {
      const stops = [
        makeStop("LOADING", "2026-06-10", "07:30", "Warszawa", "PL"),
        makeStop("UNLOADING", "2026-06-12", "15:00", "Praga", "CZ"),
      ];

      const result = computeDenormalizedFields(stops, []);

      // First i last loading to ten sam stop
      expect(result.first_loading_date).toBe("2026-06-10");
      expect(result.last_loading_date).toBe("2026-06-10");
      expect(result.first_unloading_date).toBe("2026-06-12");
      expect(result.last_unloading_date).toBe("2026-06-12");
    });
  });

  describe("summary_route", () => {
    it("formatuje trasę z country: 'PL: Kęty → DE: Hamburg'", () => {
      const stops = [
        makeStop("LOADING", null, null, "Kęty", "PL"),
        makeStop("UNLOADING", null, null, "Hamburg", "DE"),
      ];

      const result = computeDenormalizedFields(stops, []);
      expect(result.summary_route).toBe("PL: Kęty → DE: Hamburg");
    });

    it("wiele stopów → pełna trasa ze strzałkami", () => {
      const stops = [
        makeStop("LOADING", null, null, "Kęty", "PL"),
        makeStop("LOADING", null, null, "Kraków", "PL"),
        makeStop("UNLOADING", null, null, "Hamburg", "DE"),
      ];

      const result = computeDenormalizedFields(stops, []);
      expect(result.summary_route).toBe("PL: Kęty → PL: Kraków → DE: Hamburg");
    });

    it("null locationNameSnapshot → '?' jako nazwa", () => {
      const stops = [
        makeStop("LOADING", null, null, null, "PL"),
        makeStop("UNLOADING", null, null, null, "DE"),
      ];

      const result = computeDenormalizedFields(stops, []);
      expect(result.summary_route).toBe("PL: ? → DE: ?");
    });

    it("null country → nazwa bez prefiksu", () => {
      const stops = [
        makeStop("LOADING", null, null, "Kęty", null),
        makeStop("UNLOADING", null, null, "Hamburg", null),
      ];

      const result = computeDenormalizedFields(stops, []);
      expect(result.summary_route).toBe("Kęty → Hamburg");
    });

    it("null country + null locationName → '?'", () => {
      const stops = [makeStop("LOADING", null, null, null, null)];

      const result = computeDenormalizedFields(stops, []);
      expect(result.summary_route).toBe("?");
    });
  });

  describe("transport_year", () => {
    it("ekstrakcja roku z first_loading_date", () => {
      const stops = [makeStop("LOADING", "2025-11-15", null)];

      const result = computeDenormalizedFields(stops, []);
      expect(result.transport_year).toBe(2025);
    });

    it("brak first_loading_date → bieżący rok", () => {
      const result = computeDenormalizedFields([], []);
      expect(result.transport_year).toBe(new Date().getFullYear());
    });

    it("LOADING z dateLocal null → bieżący rok (fallback)", () => {
      const stops = [makeStop("LOADING", null, null)];

      const result = computeDenormalizedFields(stops, []);
      expect(result.transport_year).toBe(new Date().getFullYear());
    });
  });

  describe("main_product_name z items", () => {
    it("pierwszy produkt z niepustym productNameSnapshot", () => {
      const items = [makeItem("Stal nierdzewna"), makeItem("Miedź")];

      const result = computeDenormalizedFields([], items);
      expect(result.main_product_name).toBe("Stal nierdzewna");
    });

    it("puste items → null", () => {
      const result = computeDenormalizedFields([], []);
      expect(result.main_product_name).toBeNull();
    });

    it("items z null productNameSnapshot → null", () => {
      const items = [makeItem(null), makeItem(null)];

      const result = computeDenormalizedFields([], items);
      expect(result.main_product_name).toBeNull();
    });

    it("pierwszy item pusty string, drugi z nazwą → zwraca drugi", () => {
      const items = [makeItem("  "), makeItem("Aluminium")];

      const result = computeDenormalizedFields([], items);
      expect(result.main_product_name).toBe("Aluminium");
    });
  });

  describe("null dateLocal w stopach", () => {
    it("LOADING z null dateLocal → first/last loading date null", () => {
      const stops = [makeStop("LOADING", null, null, "Kęty", "PL")];

      const result = computeDenormalizedFields(stops, []);
      expect(result.first_loading_date).toBeNull();
      expect(result.first_loading_time).toBeNull();
      expect(result.last_loading_date).toBeNull();
      expect(result.last_loading_time).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// buildSearchText
// ---------------------------------------------------------------------------

describe("buildSearchText", () => {
  it("pełne dane → połączony tekst ze spacjami", () => {
    const result = buildSearchText(
      "ZT2026/0001",
      "TransPol",
      [
        { companyNameSnapshot: "NordMetal", locationNameSnapshot: "Magazyn Kęty" },
        { companyNameSnapshot: "RecyFirma", locationNameSnapshot: "Hala Berlin" },
      ],
      [{ productNameSnapshot: "Stal nierdzewna" }],
      "Pilne zamówienie"
    );

    expect(result).toBe(
      "ZT2026/0001 TransPol NordMetal Magazyn Kęty RecyFirma Hala Berlin Stal nierdzewna Pilne zamówienie"
    );
  });

  it("null carrierName → brak w tekście", () => {
    const result = buildSearchText(
      "ZT2026/0002",
      null,
      [],
      [],
      null
    );

    expect(result).toBe("ZT2026/0002");
  });

  it("tylko orderNo, reszta pusta/null → sam orderNo", () => {
    const result = buildSearchText("ZT2026/0003", null, [], [], null);
    expect(result).toBe("ZT2026/0003");
  });

  it("stops z null snapshots → pomija null pola", () => {
    const result = buildSearchText(
      "ZT2026/0004",
      null,
      [
        { companyNameSnapshot: null, locationNameSnapshot: null },
        { companyNameSnapshot: "Firma", locationNameSnapshot: null },
      ],
      [{ productNameSnapshot: null }],
      null
    );

    expect(result).toBe("ZT2026/0004 Firma");
  });

  it("notes z tekstem → dołączone na końcu", () => {
    const result = buildSearchText(
      "ZT2026/0005",
      null,
      [],
      [],
      "Uwaga: towar ADR"
    );

    expect(result).toBe("ZT2026/0005 Uwaga: towar ADR");
  });

  it("wiele items z productNameSnapshot → wszystkie dołączone", () => {
    const result = buildSearchText(
      "ZT2026/0006",
      null,
      [],
      [
        { productNameSnapshot: "Stal" },
        { productNameSnapshot: "Miedź" },
        { productNameSnapshot: "Aluminium" },
      ],
      null
    );

    expect(result).toBe("ZT2026/0006 Stal Miedź Aluminium");
  });
});

// ---------------------------------------------------------------------------
// autoSetDocumentsAndCurrency
// ---------------------------------------------------------------------------

describe("autoSetDocumentsAndCurrency", () => {
  it('PL → "WZ, KPO, kwit wagowy"', () => {
    const result = autoSetDocumentsAndCurrency("PL", "PLN");

    expect(result.requiredDocumentsText).toBe("WZ, KPO, kwit wagowy");
    expect(result.currencyCode).toBe("PLN");
  });

  it('EXP → "WZE, Aneks VII, CMR"', () => {
    const result = autoSetDocumentsAndCurrency("EXP", "EUR");

    expect(result.requiredDocumentsText).toBe("WZE, Aneks VII, CMR");
    expect(result.currencyCode).toBe("EUR");
  });

  it('EXP_K → "WZE, Aneks VII, CMR"', () => {
    const result = autoSetDocumentsAndCurrency("EXP_K", "EUR");

    expect(result.requiredDocumentsText).toBe("WZE, Aneks VII, CMR");
    expect(result.currencyCode).toBe("EUR");
  });

  it('IMP → "WZE, Aneks VII, CMR"', () => {
    const result = autoSetDocumentsAndCurrency("IMP", "EUR");

    expect(result.requiredDocumentsText).toBe("WZE, Aneks VII, CMR");
    expect(result.currencyCode).toBe("EUR");
  });

  it('nieznany kod → pusty string requiredDocumentsText', () => {
    const result = autoSetDocumentsAndCurrency("UNKNOWN", "USD");

    expect(result.requiredDocumentsText).toBe("");
    expect(result.currencyCode).toBe("USD");
  });

  it("currencyCode przekazany jako parametr → zwracany bez zmian", () => {
    // Funkcja nie zmienia currencyCode — po prostu przepuszcza userCurrency
    const result = autoSetDocumentsAndCurrency("PL", "GBP");

    expect(result.currencyCode).toBe("GBP");
  });
});
