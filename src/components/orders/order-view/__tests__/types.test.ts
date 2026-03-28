/**
 * Testy mapperow OrderView: formDataToViewData / viewDataToFormData
 *
 * Pokrywaja bidirectional mapping (forward + reverse) oraz edge-case'y,
 * żeby zapobiec silent data loss przy zapisie z podgladu A4.
 */

import { describe, it, expect } from "vitest";
import type { CompanyDto, LocationDto, ProductDto } from "@/types";
import type {
  OrderFormData,
  OrderFormItem,
  OrderFormStop,
  CurrencyCode,
} from "@/lib/view-models";
import {
  formDataToViewData,
  viewDataToFormData,
  mapLoadingMethodToPackaging,
  mapPackagingToLoadingMethod,
  resolveCarrierAddress,
  buildPlaceFallback,
} from "../types";
import type { OrderViewData, OrderViewItem, OrderViewStop } from "../types";

// ---------------------------------------------------------------------------
// Stale testowe
// ---------------------------------------------------------------------------

const COMPANY_CARRIER_ID = "f0000000-0000-0000-0000-000000000001";
const COMPANY_OTHER_ID = "f0000000-0000-0000-0000-000000000002";
const LOCATION_CARRIER_ID = "d0000000-0000-0000-0000-000000000010";
const LOCATION_STOP_ID = "d0000000-0000-0000-0000-000000000020";
const LOCATION_STOP2_ID = "d0000000-0000-0000-0000-000000000021";
const PRODUCT_ID = "e0000000-0000-0000-0000-000000000001";
const PRODUCT2_ID = "e0000000-0000-0000-0000-000000000002";
const ITEM_ID = "item-001";
const ITEM2_ID = "item-002";
const STOP_LOADING_ID = "stop-l1";
const STOP_UNLOADING_ID = "stop-u1";

// ---------------------------------------------------------------------------
// Fixtury — slowniki
// ---------------------------------------------------------------------------

function makeCompanies(): CompanyDto[] {
  return [
    {
      id: COMPANY_CARRIER_ID,
      name: "TransLog Sp. z o.o.",
      isActive: true,
      erpId: null,
      taxId: "1234567890",
      type: "carrier",
      notes: null,
    },
    {
      id: COMPANY_OTHER_ID,
      name: "InnaFirma S.A.",
      isActive: true,
      erpId: null,
      taxId: "9876543210",
      type: "carrier",
      notes: null,
    },
  ];
}

function makeLocations(): LocationDto[] {
  return [
    {
      id: LOCATION_CARRIER_ID,
      name: "Biuro główne",
      companyId: COMPANY_CARRIER_ID,
      companyName: "TransLog Sp. z o.o.",
      city: "Warszawa",
      country: "PL",
      streetAndNumber: "ul. Logistyczna 5",
      postalCode: "00-100",
      isActive: true,
      notes: null,
    },
    {
      id: LOCATION_STOP_ID,
      name: "Magazyn Centralny",
      companyId: COMPANY_OTHER_ID,
      companyName: "InnaFirma S.A.",
      city: "Kraków",
      country: "PL",
      streetAndNumber: "ul. Stalowa 10",
      postalCode: "30-200",
      isActive: true,
      notes: null,
    },
    {
      id: LOCATION_STOP2_ID,
      name: "Oddział Północ",
      companyId: COMPANY_OTHER_ID,
      companyName: "InnaFirma S.A.",
      city: "Gdańsk",
      country: "PL",
      streetAndNumber: "ul. Portowa 3",
      postalCode: "80-300",
      isActive: true,
      notes: null,
    },
  ];
}

function makeProducts(): ProductDto[] {
  return [
    {
      id: PRODUCT_ID,
      name: "Stal nierdzewna",
      isActive: true,
      description: null,
      defaultLoadingMethodCode: "PALETA",
    },
    {
      id: PRODUCT2_ID,
      name: "Piasek kwarcowy",
      isActive: true,
      description: null,
      defaultLoadingMethodCode: "LUZEM",
    },
  ];
}

// ---------------------------------------------------------------------------
// Fixtury — formData
// ---------------------------------------------------------------------------

function makeFormItem(overrides?: Partial<OrderFormItem>): OrderFormItem {
  return {
    id: ITEM_ID,
    productId: PRODUCT_ID,
    productNameSnapshot: "Stal nierdzewna",
    defaultLoadingMethodSnapshot: "PALETA",
    loadingMethodCode: "PALETA",
    quantityTons: 12.5,
    notes: "Uwaga: kruchy materiał",
    _deleted: false,
    _clientKey: "test-client-key",
    ...overrides,
  };
}

function makeFormStop(overrides?: Partial<OrderFormStop>): OrderFormStop {
  return {
    id: STOP_LOADING_ID,
    kind: "LOADING",
    sequenceNo: 1,
    dateLocal: "2026-03-10",
    timeLocal: "08:00",
    locationId: LOCATION_STOP_ID,
    locationNameSnapshot: "Magazyn Centralny",
    companyNameSnapshot: "InnaFirma S.A.",
    addressSnapshot: "ul. Stalowa 10, 30-200 Kraków",
    notes: "Brama nr 3",
    _deleted: false,
    ...overrides,
  };
}

function makeFormData(overrides?: Partial<OrderFormData>): OrderFormData {
  return {
    transportTypeCode: "PL",
    currencyCode: "PLN",
    priceAmount: 5000,
    paymentTermDays: 30,
    paymentMethod: "przelew",
    totalLoadTons: 20,
    totalLoadVolumeM3: 40,
    carrierCompanyId: COMPANY_CARRIER_ID,
    shipperLocationId: null,
    receiverLocationId: null,
    vehicleTypeText: "Ciężarówka",
    vehicleCapacityVolumeM3: 90,
    specialRequirements: "ADR",
    requiredDocumentsText: "CMR, WZ",
    generalNotes: "Uwaga ogólna",
    notificationDetails: "Tel: 123456789",
    confidentialityClause: "Klauzula poufności ABC",
    complaintReason: null,
    senderContactName: "Jan Kowalski",
    senderContactPhone: "+48 600 000 000",
    senderContactEmail: "jan@test.pl",
    stops: [
      makeFormStop(),
      makeFormStop({
        id: STOP_UNLOADING_ID,
        kind: "UNLOADING",
        sequenceNo: 2,
        dateLocal: "2026-03-11",
        timeLocal: "14:00",
        locationId: LOCATION_STOP2_ID,
        locationNameSnapshot: "Oddział Północ",
        companyNameSnapshot: "InnaFirma S.A.",
        addressSnapshot: "ul. Portowa 3, 80-300 Gdańsk",
        notes: null,
      }),
    ],
    items: [makeFormItem()],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Stale do forward mappera
// ---------------------------------------------------------------------------

const ORDER_NO = "ZT2026/0042";
const CREATED_AT = "2026-03-01";
const PERSON_NAME = "Anna Nowak";
const PERSON_EMAIL = "anna@test.pl";
const PERSON_PHONE = "+48 500 000 000";

// ---------------------------------------------------------------------------
// Helper: wywolaj forward mapper z domyslnymi parametrami
// ---------------------------------------------------------------------------

function callForward(formData?: OrderFormData): OrderViewData {
  return formDataToViewData(
    formData ?? makeFormData(),
    ORDER_NO,
    CREATED_AT,
    PERSON_NAME,
    PERSON_EMAIL,
    PERSON_PHONE,
    makeLocations(),
    makeCompanies(),
  );
}

// ---------------------------------------------------------------------------
// Helper: wywolaj reverse mapper z domyslnymi parametrami
// ---------------------------------------------------------------------------

function callReverse(
  viewData: OrderViewData,
  originalFormData?: OrderFormData,
): OrderFormData {
  return viewDataToFormData(
    viewData,
    originalFormData ?? makeFormData(),
    makeLocations(),
    makeCompanies(),
    makeProducts(),
  );
}

// ===========================================================================
// mapLoadingMethodToPackaging / mapPackagingToLoadingMethod
// ===========================================================================

describe("mapLoadingMethodToPackaging", () => {
  it("mapuje LUZEM → LUZEM", () => {
    expect(mapLoadingMethodToPackaging("LUZEM")).toBe("LUZEM");
  });

  it("mapuje PALETA_BIGBAG → BIGBAG", () => {
    expect(mapLoadingMethodToPackaging("PALETA_BIGBAG")).toBe("BIGBAG");
  });

  it("mapuje PALETA → PALETA", () => {
    expect(mapLoadingMethodToPackaging("PALETA")).toBe("PALETA");
  });

  it("mapuje KOSZE → INNA", () => {
    expect(mapLoadingMethodToPackaging("KOSZE")).toBe("INNA");
  });

  it("zwraca null dla null", () => {
    expect(mapLoadingMethodToPackaging(null)).toBeNull();
  });

  it("zwraca null dla nieznanego kodu", () => {
    expect(mapLoadingMethodToPackaging("NIEZNANY")).toBeNull();
  });
});

describe("mapPackagingToLoadingMethod", () => {
  it("mapuje LUZEM → LUZEM", () => {
    expect(mapPackagingToLoadingMethod("LUZEM")).toBe("LUZEM");
  });

  it("mapuje BIGBAG → PALETA_BIGBAG", () => {
    expect(mapPackagingToLoadingMethod("BIGBAG")).toBe("PALETA_BIGBAG");
  });

  it("mapuje PALETA → PALETA", () => {
    expect(mapPackagingToLoadingMethod("PALETA")).toBe("PALETA");
  });

  it("mapuje INNA → KOSZE", () => {
    expect(mapPackagingToLoadingMethod("INNA")).toBe("KOSZE");
  });

  it("zwraca null dla null", () => {
    expect(mapPackagingToLoadingMethod(null)).toBeNull();
  });
});

// ===========================================================================
// resolveCarrierAddress
// ===========================================================================

describe("resolveCarrierAddress", () => {
  it("zwraca adres aktywnej lokalizacji przewoźnika", () => {
    const result = resolveCarrierAddress(COMPANY_CARRIER_ID, makeLocations());
    expect(result).toBe("ul. Logistyczna 5, 00-100 Warszawa");
  });

  it("zwraca pusty string dla null carrierCompanyId", () => {
    expect(resolveCarrierAddress(null, makeLocations())).toBe("");
  });

  it("zwraca pusty string gdy brak lokalizacji dla firmy", () => {
    expect(
      resolveCarrierAddress("non-existent-id", makeLocations()),
    ).toBe("");
  });

  it("pomija nieaktywne lokalizacje", () => {
    const locations = makeLocations().map((l) =>
      l.companyId === COMPANY_CARRIER_ID ? { ...l, isActive: false } : l,
    );
    expect(resolveCarrierAddress(COMPANY_CARRIER_ID, locations)).toBe("");
  });
});

// ===========================================================================
// buildPlaceFallback
// ===========================================================================

describe("buildPlaceFallback", () => {
  it("buduje tekst z lokalizacji gdy dostepna", () => {
    const stop = makeFormStop();
    const loc = makeLocations().find((l) => l.id === LOCATION_STOP_ID)!;
    const result = buildPlaceFallback(stop, loc);
    expect(result).toContain("InnaFirma S.A.");
    expect(result).toContain("Kraków");
  });

  it("fallback na snapshot gdy brak lokalizacji", () => {
    const stop = makeFormStop({
      companyNameSnapshot: "SnapshotFirma",
      addressSnapshot: "ul. Snapshot 1",
    });
    const result = buildPlaceFallback(stop, null);
    expect(result).toContain("SnapshotFirma");
    expect(result).toContain("ul. Snapshot 1");
  });

  it("fallback na companyNameSnapshot gdy brak addressSnapshot", () => {
    const stop = makeFormStop({
      companyNameSnapshot: "TylkoFirma",
      addressSnapshot: null,
    });
    const result = buildPlaceFallback(stop, null);
    expect(result).toBe("TylkoFirma");
  });

  it("fallback na locationNameSnapshot gdy brak company i address snapshot", () => {
    const stop = makeFormStop({
      companyNameSnapshot: null,
      addressSnapshot: null,
      locationNameSnapshot: "Magazyn X",
    });
    const result = buildPlaceFallback(stop, null);
    expect(result).toBe("Magazyn X");
  });

  it("zwraca pusty string gdy wszystkie snapshoty null i brak lokalizacji", () => {
    const stop = makeFormStop({
      companyNameSnapshot: null,
      addressSnapshot: null,
      locationNameSnapshot: null,
    });
    const result = buildPlaceFallback(stop, null);
    expect(result).toBe("");
  });
});

// ===========================================================================
// formDataToViewData (forward mapper)
// ===========================================================================

describe("formDataToViewData", () => {
  it("mapuje pola naglowkowe (orderNo, createdAt, person*)", () => {
    const result = callForward();
    expect(result.orderNo).toBe(ORDER_NO);
    expect(result.createdAt).toBe(CREATED_AT);
    expect(result.personName).toBe(PERSON_NAME);
    expect(result.personEmail).toBe(PERSON_EMAIL);
    expect(result.personPhone).toBe(PERSON_PHONE);
  });

  it("resolve'uje dane firmy transportowej z companies", () => {
    const result = callForward();
    expect(result.carrierName).toBe("TransLog Sp. z o.o.");
    expect(result.carrierNip).toBe("1234567890");
    expect(result.carrierAddress).toBe("ul. Logistyczna 5, 00-100 Warszawa");
  });

  it("mapuje pola pojazdu", () => {
    const result = callForward();
    expect(result.vehicleType).toBe("Ciężarówka");
    expect(result.vehicleVolumeM3).toBe(90);
  });

  it("mapuje pola finansowe", () => {
    const result = callForward();
    expect(result.priceAmount).toBe(5000);
    expect(result.currencyCode).toBe("PLN");
    expect(result.paymentTermDays).toBe(30);
    expect(result.paymentMethod).toBe("przelew");
  });

  it("mapuje documentsText, generalNotes, confidentialityClause", () => {
    const result = callForward();
    expect(result.documentsText).toBe("CMR, WZ");
    expect(result.generalNotes).toBe("Uwaga ogólna");
    expect(result.confidentialityClause).toBe("Klauzula poufności ABC");
  });

  // Items
  describe("items", () => {
    it("mapuje productNameSnapshot → name", () => {
      const result = callForward();
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("Stal nierdzewna");
    });

    it("mapuje loadingMethodCode → packagingType (PALETA)", () => {
      const result = callForward();
      expect(result.items[0].packagingType).toBe("PALETA");
    });

    it("mapuje notes", () => {
      const result = callForward();
      expect(result.items[0].notes).toBe("Uwaga: kruchy materiał");
    });

    it("zachowuje id z formData", () => {
      const result = callForward();
      expect(result.items[0].id).toBe(ITEM_ID);
    });

    it("filtruje _deleted items", () => {
      const formData = makeFormData({
        items: [
          makeFormItem(),
          makeFormItem({ id: ITEM2_ID, _deleted: true }),
        ],
      });
      const result = callForward(formData);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(ITEM_ID);
    });

    it("mapuje null loadingMethodCode → null packagingType", () => {
      const formData = makeFormData({
        items: [makeFormItem({ loadingMethodCode: null })],
      });
      const result = callForward(formData);
      expect(result.items[0].packagingType).toBeNull();
    });
  });

  // Stops
  describe("stops", () => {
    it("mapuje kind, sequenceNo, date, time", () => {
      const result = callForward();
      expect(result.stops).toHaveLength(2);

      const loadingStop = result.stops[0];
      expect(loadingStop.kind).toBe("LOADING");
      expect(loadingStop.sequenceNo).toBe(1);
      expect(loadingStop.date).toBe("2026-03-10");
      expect(loadingStop.time).toBe("08:00");

      const unloadingStop = result.stops[1];
      expect(unloadingStop.kind).toBe("UNLOADING");
      expect(unloadingStop.sequenceNo).toBe(2);
      expect(unloadingStop.date).toBe("2026-03-11");
      expect(unloadingStop.time).toBe("14:00");
    });

    it("resolve'uje locationId → nazwe i adres z locations", () => {
      const result = callForward();
      const stop = result.stops[0];
      // locationId = LOCATION_STOP_ID → "Magazyn Centralny" (snapshot ma priorytet)
      expect(stop.locationId).toBe(LOCATION_STOP_ID);
      expect(stop.companyName).toBe("InnaFirma S.A.");
      expect(stop.country).toBe("PL");
    });

    it("filtruje _deleted stops", () => {
      const formData = makeFormData({
        stops: [
          makeFormStop(),
          makeFormStop({
            id: STOP_UNLOADING_ID,
            kind: "UNLOADING",
            sequenceNo: 2,
            _deleted: true,
          }),
        ],
      });
      const result = callForward(formData);
      expect(result.stops).toHaveLength(1);
    });

    it("uzupelnia companyName z snapshot gdy brak w locations", () => {
      const formData = makeFormData({
        stops: [
          makeFormStop({
            locationId: null,
            companyNameSnapshot: "Firma ze snapshot",
            locationNameSnapshot: "Lokalizacja ze snapshot",
          }),
        ],
      });
      const result = callForward(formData);
      expect(result.stops[0].companyName).toBe("Firma ze snapshot");
      expect(result.stops[0].locationName).toBe("Lokalizacja ze snapshot");
    });
  });

  // Edge cases
  describe("edge cases", () => {
    it("puste tablice items i stops", () => {
      const formData = makeFormData({ items: [], stops: [] });
      const result = callForward(formData);
      expect(result.items).toEqual([]);
      expect(result.stops).toEqual([]);
    });

    it("null carrierCompanyId → puste dane carrier", () => {
      const formData = makeFormData({ carrierCompanyId: null });
      const result = callForward(formData);
      expect(result.carrierName).toBe("");
      expect(result.carrierNip).toBe("");
      expect(result.carrierAddress).toBe("");
    });

    it("null vehicleTypeText → pusty vehicleType", () => {
      const formData = makeFormData({ vehicleTypeText: null });
      const result = callForward(formData);
      expect(result.vehicleType).toBe("");
    });

    it("null vehicleCapacityVolumeM3 → null vehicleVolumeM3", () => {
      const formData = makeFormData({ vehicleCapacityVolumeM3: null });
      const result = callForward(formData);
      expect(result.vehicleVolumeM3).toBeNull();
    });

    it("null generalNotes/requiredDocumentsText/confidentialityClause → pusty string", () => {
      const formData = makeFormData({
        generalNotes: null,
        requiredDocumentsText: null,
        confidentialityClause: null,
      });
      const result = callForward(formData);
      expect(result.generalNotes).toBe("");
      expect(result.documentsText).toBe("");
      expect(result.confidentialityClause).toBe("");
    });
  });
});

// ===========================================================================
// viewDataToFormData (reverse mapper)
// ===========================================================================

describe("viewDataToFormData", () => {
  // Pelny roundtrip: formData → viewData → formData
  describe("roundtrip (formData → viewData → formData)", () => {
    it("zachowuje kluczowe pola edytowalne po roundtripie", () => {
      const original = makeFormData();
      const viewData = callForward(original);
      const restored = callReverse(viewData, original);

      // Pola finansowe
      expect(restored.priceAmount).toBe(original.priceAmount);
      expect(restored.currencyCode).toBe(original.currencyCode);
      expect(restored.paymentTermDays).toBe(original.paymentTermDays);
      expect(restored.paymentMethod).toBe(original.paymentMethod);

      // Pojazd
      expect(restored.vehicleTypeText).toBe(original.vehicleTypeText);
      expect(restored.vehicleCapacityVolumeM3).toBe(
        original.vehicleCapacityVolumeM3,
      );

      // Carrier — resolve po nazwie → ten sam id
      expect(restored.carrierCompanyId).toBe(original.carrierCompanyId);

      // Dokumenty / uwagi
      expect(restored.requiredDocumentsText).toBe(
        original.requiredDocumentsText,
      );
      expect(restored.generalNotes).toBe(original.generalNotes);
      expect(restored.confidentialityClause).toBe(
        original.confidentialityClause,
      );
    });

    it("zachowuje pola ukryte z originalFormData", () => {
      const original = makeFormData();
      const viewData = callForward(original);
      const restored = callReverse(viewData, original);

      expect(restored.transportTypeCode).toBe(original.transportTypeCode);
      expect(restored.totalLoadTons).toBe(original.totalLoadTons);
      expect(restored.totalLoadVolumeM3).toBe(original.totalLoadVolumeM3);
      expect(restored.specialRequirements).toBe(original.specialRequirements);
      expect(restored.complaintReason).toBe(original.complaintReason);
      expect(restored.notificationDetails).toBe(original.notificationDetails);
      expect(restored.senderContactName).toBe(original.senderContactName);
      expect(restored.senderContactPhone).toBe(original.senderContactPhone);
      expect(restored.senderContactEmail).toBe(original.senderContactEmail);
      expect(restored.shipperLocationId).toBe(original.shipperLocationId);
      expect(restored.receiverLocationId).toBe(original.receiverLocationId);
    });
  });

  // Items roundtrip
  describe("items roundtrip", () => {
    it("zachowuje productId i loadingMethodCode po roundtripie", () => {
      const original = makeFormData();
      const viewData = callForward(original);
      const restored = callReverse(viewData, original);

      expect(restored.items).toHaveLength(1);
      const item = restored.items[0];
      expect(item.productId).toBe(PRODUCT_ID);
      expect(item.productNameSnapshot).toBe("Stal nierdzewna");
      expect(item.loadingMethodCode).toBe("PALETA");
    });

    it("zachowuje quantityTons gdy produkt sie nie zmienil", () => {
      const original = makeFormData();
      const viewData = callForward(original);
      const restored = callReverse(viewData, original);

      expect(restored.items[0].quantityTons).toBe(12.5);
    });

    it("resetuje quantityTons gdy produkt sie zmienil", () => {
      const original = makeFormData({
        items: [makeFormItem({ productId: PRODUCT_ID })],
      });
      const viewData = callForward(original);
      // Symuluj zmianę produktu w A4 (autocomplete aktualizuje id + name razem)
      viewData.items[0].productId = PRODUCT2_ID;
      viewData.items[0].name = "Piasek kwarcowy";
      const restored = callReverse(viewData, original);

      // Piasek kwarcowy ma PRODUCT2_ID, a oryginal mial PRODUCT_ID → productChanged = true
      expect(restored.items[0].productId).toBe(PRODUCT2_ID);
      expect(restored.items[0].quantityTons).toBeNull();
    });

    it("zachowuje notes po roundtripie", () => {
      const original = makeFormData();
      const viewData = callForward(original);
      const restored = callReverse(viewData, original);

      expect(restored.items[0].notes).toBe("Uwaga: kruchy materiał");
    });

    it("mapuje packaging BIGBAG → PALETA_BIGBAG w reverse", () => {
      const original = makeFormData({
        items: [makeFormItem({ loadingMethodCode: "PALETA_BIGBAG" })],
      });
      const viewData = callForward(original);
      expect(viewData.items[0].packagingType).toBe("BIGBAG");

      const restored = callReverse(viewData, original);
      expect(restored.items[0].loadingMethodCode).toBe("PALETA_BIGBAG");
    });

    it("mapuje packaging LUZEM ↔ LUZEM w obie strony", () => {
      const original = makeFormData({
        items: [makeFormItem({ loadingMethodCode: "LUZEM" })],
      });
      const viewData = callForward(original);
      expect(viewData.items[0].packagingType).toBe("LUZEM");

      const restored = callReverse(viewData, original);
      expect(restored.items[0].loadingMethodCode).toBe("LUZEM");
    });
  });

  // Stops roundtrip
  describe("stops roundtrip", () => {
    it("zachowuje kind, dateLocal, timeLocal, locationId po roundtripie", () => {
      const original = makeFormData();
      const viewData = callForward(original);
      const restored = callReverse(viewData, original);

      expect(restored.stops).toHaveLength(2);

      const loadingStop = restored.stops[0];
      expect(loadingStop.kind).toBe("LOADING");
      expect(loadingStop.dateLocal).toBe("2026-03-10");
      expect(loadingStop.timeLocal).toBe("08:00");
      expect(loadingStop.locationId).toBe(LOCATION_STOP_ID);

      const unloadingStop = restored.stops[1];
      expect(unloadingStop.kind).toBe("UNLOADING");
      expect(unloadingStop.dateLocal).toBe("2026-03-11");
      expect(unloadingStop.timeLocal).toBe("14:00");
      expect(unloadingStop.locationId).toBe(LOCATION_STOP2_ID);
    });

    it("odtwarza snapshoty z lokalizacji w reverse", () => {
      const original = makeFormData();
      const viewData = callForward(original);
      const restored = callReverse(viewData, original);

      const stop = restored.stops[0];
      // Reverse mapper resolve'uje z locations (bo locationId jest ustawiony)
      expect(stop.locationNameSnapshot).toBe("Magazyn Centralny");
      expect(stop.companyNameSnapshot).toBe("InnaFirma S.A.");
      expect(stop.addressSnapshot).toBe(
        "ul. Stalowa 10, 30-200 Kraków",
      );
    });

    it("zachowuje notes z originalStops", () => {
      const original = makeFormData();
      const viewData = callForward(original);
      const restored = callReverse(viewData, original);

      // notes z oryginalu loading stopu = "Brama nr 3"
      expect(restored.stops[0].notes).toBe("Brama nr 3");
    });
  });

  // Carrier resolve
  describe("carrier resolve", () => {
    it("resolve'uje carrierCompanyId z ID (autocomplete aktualizuje id + name)", () => {
      const original = makeFormData();
      const viewData = callForward(original);
      // Symuluj zmianę carrier w A4 (autocomplete aktualizuje id + name razem)
      viewData.carrierCompanyId = COMPANY_OTHER_ID;
      viewData.carrierName = "InnaFirma S.A.";
      const restored = callReverse(viewData, original);

      expect(restored.carrierCompanyId).toBe(COMPANY_OTHER_ID);
    });

    it("fallback do originalFormData.carrierCompanyId gdy nazwa nieznana", () => {
      const original = makeFormData();
      const viewData = callForward(original);
      viewData.carrierName = "Nieistniejaca Firma XYZ";
      const restored = callReverse(viewData, original);

      // Nie znaleziono po nazwie → fallback do oryginalu
      expect(restored.carrierCompanyId).toBe(COMPANY_CARRIER_ID);
    });

    it("ustawia null gdy carrier pusty w obu zrodlach", () => {
      const original = makeFormData({ carrierCompanyId: null });
      const viewData = callForward(original);
      viewData.carrierName = "";
      const restored = callReverse(viewData, original);

      expect(restored.carrierCompanyId).toBeNull();
    });
  });

  // Merge items (nowe + usuniete)
  describe("merge items (nowe + usuniete)", () => {
    it("dodaje nowy item z viewData (brak oryginalnego id)", () => {
      const original = makeFormData({ items: [makeFormItem()] });
      const viewData = callForward(original);

      // Dodaj nowy item w viewData
      viewData.items.push({
        id: "new-item-from-view",
        productId: null,
        name: "Piasek kwarcowy",
        notes: "Nowa pozycja",
        packagingType: "LUZEM",
      });

      const restored = callReverse(viewData, original);

      expect(restored.items).toHaveLength(2);
      // Pierwszy: oryginalny
      expect(restored.items[0].id).toBe(ITEM_ID);
      // Drugi: nowy (id = null bo nie znaleziono w originalItems)
      expect(restored.items[1].id).toBeNull();
      expect(restored.items[1].productNameSnapshot).toBe("Piasek kwarcowy");
      expect(restored.items[1].loadingMethodCode).toBe("LUZEM");
    });

    it("oznacza usuniety item _deleted=true", () => {
      const original = makeFormData({
        items: [
          makeFormItem(),
          makeFormItem({
            id: ITEM2_ID,
            productNameSnapshot: "Drugi produkt",
          }),
        ],
      });
      const viewData = callForward(original);

      // Usun drugi item z viewData
      viewData.items = viewData.items.filter((i) => i.id !== ITEM2_ID);

      const restored = callReverse(viewData, original);

      // Powinien byc 1 aktywny + 1 deleted
      expect(restored.items).toHaveLength(2);
      const active = restored.items.filter((i) => !i._deleted);
      const deleted = restored.items.filter((i) => i._deleted);
      expect(active).toHaveLength(1);
      expect(deleted).toHaveLength(1);
      expect(deleted[0].id).toBe(ITEM2_ID);
    });
  });

  // Merge stops (nowe + usuniete)
  describe("merge stops (nowe + usuniete)", () => {
    it("dodaje nowy stop z viewData (brak oryginalnego id)", () => {
      const original = makeFormData();
      const viewData = callForward(original);

      // Dodaj nowy stop
      viewData.stops.push({
        id: "new-stop-from-view",
        kind: "UNLOADING",
        sequenceNo: 3,
        date: "2026-03-12",
        time: "10:00",
        companyId: null,
        companyName: "Nowa firma",
        locationId: null,
        locationName: null,
        address: null,
        country: "PL",
        place: "Nowa firma",
      });

      const restored = callReverse(viewData, original);

      expect(restored.stops).toHaveLength(3);
      // Nowy stop — id = null (nie znaleziono w originalStops)
      const newStop = restored.stops[2];
      expect(newStop.id).toBeNull();
      expect(newStop.kind).toBe("UNLOADING");
      expect(newStop.dateLocal).toBe("2026-03-12");
      expect(newStop.timeLocal).toBe("10:00");
    });

    it("oznacza usuniety stop _deleted=true", () => {
      const original = makeFormData();
      const viewData = callForward(original);

      // Usun unloading stop
      viewData.stops = viewData.stops.filter(
        (s) => s.id !== STOP_UNLOADING_ID,
      );

      const restored = callReverse(viewData, original);

      const deleted = restored.stops.filter((s) => s._deleted);
      expect(deleted).toHaveLength(1);
      expect(deleted[0].id).toBe(STOP_UNLOADING_ID);
    });
  });

  // Konwersja pustych stringow → null
  describe("konwersja pustych stringów → null", () => {
    it("pusty vehicleType → null vehicleTypeText", () => {
      const original = makeFormData();
      const viewData = callForward(original);
      viewData.vehicleType = "";
      const restored = callReverse(viewData, original);

      expect(restored.vehicleTypeText).toBeNull();
    });

    it("pusty generalNotes → null", () => {
      const original = makeFormData();
      const viewData = callForward(original);
      viewData.generalNotes = "";
      const restored = callReverse(viewData, original);

      expect(restored.generalNotes).toBeNull();
    });

    it("pusty documentsText → null requiredDocumentsText", () => {
      const original = makeFormData();
      const viewData = callForward(original);
      viewData.documentsText = "";
      const restored = callReverse(viewData, original);

      expect(restored.requiredDocumentsText).toBeNull();
    });

    it("pusty confidentialityClause → null", () => {
      const original = makeFormData();
      const viewData = callForward(original);
      viewData.confidentialityClause = "";
      const restored = callReverse(viewData, original);

      expect(restored.confidentialityClause).toBeNull();
    });

    it("pusty paymentMethod → null", () => {
      const original = makeFormData();
      const viewData = callForward(original);
      viewData.paymentMethod = "";
      const restored = callReverse(viewData, original);

      expect(restored.paymentMethod).toBeNull();
    });
  });
});
