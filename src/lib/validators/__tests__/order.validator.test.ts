/**
 * Testy schematów Zod z order.validator.ts.
 * Pure validation — zero mocków.
 */

import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import {
  orderListQuerySchema,
  changeStatusSchema,
  createOrderSchema,
  updateOrderSchema,
  duplicateOrderSchema,
  carrierCellColorSchema,
  patchStopSchema,
  prepareEmailSchema,
  dictionarySyncSchema,
} from "../order.validator";

const VALID_UUID = "a0000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// orderListQuerySchema
// ---------------------------------------------------------------------------

describe("orderListQuerySchema", () => {
  it("{} → defaults (view: CURRENT, sortBy: FIRST_LOADING_DATETIME, ASC, page:1, pageSize:50)", () => {
    const result = orderListQuerySchema.parse({});
    expect(result.view).toBe("CURRENT");
    expect(result.sortBy).toBe("FIRST_LOADING_DATETIME");
    expect(result.sortDirection).toBe("ASC");
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
  });

  it('view: "COMPLETED" → OK', () => {
    const result = orderListQuerySchema.parse({ view: "COMPLETED" });
    expect(result.view).toBe("COMPLETED");
  });

  it('view: "INVALID" → ZodError', () => {
    expect(() => orderListQuerySchema.parse({ view: "INVALID" })).toThrow(ZodError);
  });

  it('status: "robocze" → OK (single)', () => {
    const result = orderListQuerySchema.parse({ status: "robocze" });
    expect(result.status).toBe("robocze");
  });

  it('status: ["robocze", "wysłane"] → OK (array)', () => {
    const result = orderListQuerySchema.parse({ status: ["robocze", "wysłane"] });
    expect(result.status).toEqual(["robocze", "wysłane"]);
  });

  it('transportType: "PL" → OK; "KRAJ" → ZodError', () => {
    expect(orderListQuerySchema.parse({ transportType: "PL" }).transportType).toBe("PL");
    expect(() => orderListQuerySchema.parse({ transportType: "KRAJ" })).toThrow(ZodError);
  });

  it('carrierId: "not-uuid" → ZodError', () => {
    expect(() => orderListQuerySchema.parse({ carrierId: "not-uuid" })).toThrow(ZodError);
  });

  it('dateFrom: "17.02.2026" → ZodError (nie ISO)', () => {
    expect(() => orderListQuerySchema.parse({ dateFrom: "17.02.2026" })).toThrow(ZodError);
  });

  it("dateFrom: poprawna data ISO → OK", () => {
    const result = orderListQuerySchema.parse({ dateFrom: "2026-02-17" });
    expect(result.dateFrom).toBe("2026-02-17");
  });
});

// ---------------------------------------------------------------------------
// changeStatusSchema
// ---------------------------------------------------------------------------

describe("changeStatusSchema", () => {
  it('{ newStatusCode: "zrealizowane" } → OK', () => {
    const result = changeStatusSchema.parse({ newStatusCode: "zrealizowane" });
    expect(result.newStatusCode).toBe("zrealizowane");
  });

  it('{ newStatusCode: "reklamacja", complaintReason: "powód" } → OK', () => {
    const result = changeStatusSchema.parse({
      newStatusCode: "reklamacja",
      complaintReason: "powód uszkodzenia",
    });
    expect(result.newStatusCode).toBe("reklamacja");
  });

  it('{ newStatusCode: "reklamacja" } bez complaintReason → ZodError (refine)', () => {
    expect(() =>
      changeStatusSchema.parse({ newStatusCode: "reklamacja" })
    ).toThrow(ZodError);
  });

  it('{ newStatusCode: "reklamacja", complaintReason: "" } → ZodError (trim → empty)', () => {
    expect(() =>
      changeStatusSchema.parse({
        newStatusCode: "reklamacja",
        complaintReason: "",
      })
    ).toThrow(ZodError);
  });

  it('{ newStatusCode: "reklamacja", complaintReason: "   " } → ZodError (whitespace only)', () => {
    expect(() =>
      changeStatusSchema.parse({
        newStatusCode: "reklamacja",
        complaintReason: "   ",
      })
    ).toThrow(ZodError);
  });

  it('{ newStatusCode: "robocze" } → ZodError (enum: tylko zrealizowane/reklamacja/anulowane)', () => {
    expect(() =>
      changeStatusSchema.parse({ newStatusCode: "robocze" })
    ).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// createOrderSchema
// ---------------------------------------------------------------------------

describe("createOrderSchema", () => {
  const validCreateOrder = {
    transportTypeCode: "PL",
    currencyCode: "PLN",
    carrierCompanyId: null,
    shipperLocationId: null,
    receiverLocationId: null,
    vehicleTypeText: null,
    vehicleCapacityVolumeM3: null,
    priceAmount: null,
    paymentTermDays: null,
    paymentMethod: null,
    totalLoadTons: null,
    totalLoadVolumeM3: null,
    specialRequirements: null,
    requiredDocumentsText: null,
    generalNotes: null,
    notificationDetails: null,
    senderContactName: null,
    senderContactPhone: null,
    senderContactEmail: null,
    stops: [
      { kind: "LOADING", dateLocal: null, timeLocal: null, locationId: null, notes: null },
    ],
    items: [],
  };

  it("minimalny poprawny obiekt → OK", () => {
    const result = createOrderSchema.parse(validCreateOrder);
    expect(result.transportTypeCode).toBe("PL");
  });

  it('transportTypeCode: "INVALID" → ZodError', () => {
    expect(() =>
      createOrderSchema.parse({ ...validCreateOrder, transportTypeCode: "INVALID" })
    ).toThrow(ZodError);
  });

  it('currencyCode: "GBP" → ZodError', () => {
    expect(() =>
      createOrderSchema.parse({ ...validCreateOrder, currencyCode: "GBP" })
    ).toThrow(ZodError);
  });

  it("generalNotes 501 znaków → ZodError", () => {
    expect(() =>
      createOrderSchema.parse({
        ...validCreateOrder,
        generalNotes: "a".repeat(501),
      })
    ).toThrow(ZodError);
  });

  it("generalNotes 500 znaków → OK", () => {
    const result = createOrderSchema.parse({
      ...validCreateOrder,
      generalNotes: "a".repeat(500),
    });
    expect(result.generalNotes).toHaveLength(500);
  });

  it('senderContactEmail: "not-email" → ZodError', () => {
    expect(() =>
      createOrderSchema.parse({
        ...validCreateOrder,
        senderContactEmail: "not-email",
      })
    ).toThrow(ZodError);
  });

  it("senderContactEmail: null → OK", () => {
    const result = createOrderSchema.parse(validCreateOrder);
    expect(result.senderContactEmail).toBeNull();
  });

  it('stop.kind: "OTHER" → ZodError', () => {
    expect(() =>
      createOrderSchema.parse({
        ...validCreateOrder,
        stops: [{ kind: "OTHER", dateLocal: null, timeLocal: null, locationId: null, notes: null }],
      })
    ).toThrow(ZodError);
  });

  it("item.quantityTons: -1 → ZodError", () => {
    expect(() =>
      createOrderSchema.parse({
        ...validCreateOrder,
        items: [{
          productId: null,
          productNameSnapshot: null,
          loadingMethodCode: null,
          quantityTons: -1,
          notes: null,
        }],
      })
    ).toThrow(ZodError);
  });

  it("poprawny stop i item → OK", () => {
    const result = createOrderSchema.parse({
      ...validCreateOrder,
      stops: [
        { kind: "LOADING", dateLocal: "2026-02-20", timeLocal: "08:00", locationId: VALID_UUID, notes: null },
      ],
      items: [
        { productId: VALID_UUID, productNameSnapshot: "Stal", loadingMethodCode: "PALETA", quantityTons: 10, notes: null },
      ],
    });
    expect(result.stops).toHaveLength(1);
    expect(result.items).toHaveLength(1);
  });

  // --- Limity tablic stops/items ---

  it("stops: 0 elementów → OK (zlecenie robocze może nie mieć tras)", () => {
    const result = createOrderSchema.parse({ ...validCreateOrder, stops: [] });
    expect(result.stops).toHaveLength(0);
  });

  it("stops: 11 elementów → OK (max 11)", () => {
    const stop = { kind: "LOADING" as const, dateLocal: null, timeLocal: null, locationId: null, notes: null };
    const result = createOrderSchema.parse({
      ...validCreateOrder,
      stops: Array.from({ length: 11 }, () => ({ ...stop })),
    });
    expect(result.stops).toHaveLength(11);
  });

  it("stops: 12 elementów → ZodError (powyżej max 11)", () => {
    const stop = { kind: "LOADING" as const, dateLocal: null, timeLocal: null, locationId: null, notes: null };
    expect(() =>
      createOrderSchema.parse({
        ...validCreateOrder,
        stops: Array.from({ length: 12 }, () => ({ ...stop })),
      })
    ).toThrow(ZodError);
  });

  it("items: 50 elementów → OK (max 50)", () => {
    const item = { productId: null, productNameSnapshot: null, loadingMethodCode: null, quantityTons: null, notes: null };
    const result = createOrderSchema.parse({
      ...validCreateOrder,
      items: Array.from({ length: 50 }, () => ({ ...item })),
    });
    expect(result.items).toHaveLength(50);
  });

  it("items: 51 elementów → ZodError (powyżej max 50)", () => {
    const item = { productId: null, productNameSnapshot: null, loadingMethodCode: null, quantityTons: null, notes: null };
    expect(() =>
      createOrderSchema.parse({
        ...validCreateOrder,
        items: Array.from({ length: 51 }, () => ({ ...item })),
      })
    ).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// updateOrderSchema
// ---------------------------------------------------------------------------

describe("updateOrderSchema", () => {
  it("extends create z id/sequenceNo/_deleted → OK", () => {
    const result = updateOrderSchema.parse({
      transportTypeCode: "PL",
      currencyCode: "PLN",
      carrierCompanyId: null,
      shipperLocationId: null,
      receiverLocationId: null,
      vehicleTypeText: null,
    vehicleCapacityVolumeM3: null,
      priceAmount: null,
      paymentTermDays: null,
      paymentMethod: null,
      totalLoadTons: null,
      totalLoadVolumeM3: null,
      specialRequirements: null,
      requiredDocumentsText: null,
      generalNotes: null,
      notificationDetails: null,
      senderContactName: null,
      senderContactPhone: null,
      senderContactEmail: null,
      stops: [{
        id: VALID_UUID,
        kind: "LOADING",
        dateLocal: null,
        timeLocal: null,
        locationId: null,
        notes: null,
        sequenceNo: 1,
        _deleted: false,
      }],
      items: [{
        id: VALID_UUID,
        productId: null,
        productNameSnapshot: null,
        loadingMethodCode: null,
        quantityTons: null,
        notes: null,
        _deleted: false,
      }],
    });
    expect(result.stops[0].sequenceNo).toBe(1);
  });

  it("stop bez sequenceNo → ZodError", () => {
    expect(() =>
      updateOrderSchema.parse({
        transportTypeCode: "PL",
        currencyCode: "PLN",
        carrierCompanyId: null,
        shipperLocationId: null,
        receiverLocationId: null,
        vehicleTypeText: null,
    vehicleCapacityVolumeM3: null,
        priceAmount: null,
        paymentTermDays: null,
        paymentMethod: null,
        totalLoadTons: null,
        totalLoadVolumeM3: null,
        specialRequirements: null,
        requiredDocumentsText: null,
        generalNotes: null,
        notificationDetails: null,
        senderContactName: null,
        senderContactPhone: null,
        senderContactEmail: null,
        stops: [{
          id: VALID_UUID,
          kind: "LOADING",
          dateLocal: null,
          timeLocal: null,
          locationId: null,
          notes: null,
          _deleted: false,
          // brak sequenceNo
        }],
        items: [],
      })
    ).toThrow(ZodError);
  });

  it("_deleted: true, id: null → OK", () => {
    const result = updateOrderSchema.parse({
      transportTypeCode: "PL",
      currencyCode: "PLN",
      carrierCompanyId: null,
      shipperLocationId: null,
      receiverLocationId: null,
      vehicleTypeText: null,
    vehicleCapacityVolumeM3: null,
      priceAmount: null,
      paymentTermDays: null,
      paymentMethod: null,
      totalLoadTons: null,
      totalLoadVolumeM3: null,
      specialRequirements: null,
      requiredDocumentsText: null,
      generalNotes: null,
      notificationDetails: null,
      senderContactName: null,
      senderContactPhone: null,
      senderContactEmail: null,
      stops: [{
        id: null,
        kind: "LOADING",
        dateLocal: null,
        timeLocal: null,
        locationId: null,
        notes: null,
        sequenceNo: 1,
        _deleted: true,
      }],
      items: [],
    });
    expect(result.stops[0]._deleted).toBe(true);
  });

  // --- Limity tablic stops/items (updateOrderSchema) ---

  const updateBase = {
    transportTypeCode: "PL" as const,
    currencyCode: "PLN" as const,
    carrierCompanyId: null,
    shipperLocationId: null,
    receiverLocationId: null,
    vehicleTypeText: null,
    vehicleCapacityVolumeM3: null,
    priceAmount: null,
    paymentTermDays: null,
    paymentMethod: null,
    totalLoadTons: null,
    totalLoadVolumeM3: null,
    specialRequirements: null,
    requiredDocumentsText: null,
    generalNotes: null,
    notificationDetails: null,
    senderContactName: null,
    senderContactPhone: null,
    senderContactEmail: null,
  };

  const updateStop = {
    id: null,
    kind: "LOADING" as const,
    dateLocal: null,
    timeLocal: null,
    locationId: null,
    notes: null,
    sequenceNo: 1,
    _deleted: false,
  };

  const updateItem = {
    id: null,
    productId: null,
    productNameSnapshot: null,
    loadingMethodCode: null,
    quantityTons: null,
    notes: null,
    _deleted: false,
  };

  it("stops: 0 elementów → OK (zlecenie robocze może nie mieć tras)", () => {
    const result = updateOrderSchema.parse({ ...updateBase, stops: [], items: [] });
    expect(result.stops).toHaveLength(0);
  });

  it("stops: 22 elementów → OK (max 22, uwzględnia _deleted)", () => {
    const result = updateOrderSchema.parse({
      ...updateBase,
      stops: Array.from({ length: 22 }, (_, i) => ({ ...updateStop, sequenceNo: i + 1 })),
      items: [],
    });
    expect(result.stops).toHaveLength(22);
  });

  it("stops: 23 elementów → ZodError (powyżej max 22)", () => {
    expect(() =>
      updateOrderSchema.parse({
        ...updateBase,
        stops: Array.from({ length: 23 }, (_, i) => ({ ...updateStop, sequenceNo: i + 1 })),
        items: [],
      })
    ).toThrow(ZodError);
  });

  it("items: 100 elementów → OK (max 100, uwzględnia _deleted)", () => {
    const result = updateOrderSchema.parse({
      ...updateBase,
      stops: [updateStop],
      items: Array.from({ length: 100 }, () => ({ ...updateItem })),
    });
    expect(result.items).toHaveLength(100);
  });

  it("items: 101 elementów → ZodError (powyżej max 100)", () => {
    expect(() =>
      updateOrderSchema.parse({
        ...updateBase,
        stops: [updateStop],
        items: Array.from({ length: 101 }, () => ({ ...updateItem })),
      })
    ).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// duplicateOrderSchema
// ---------------------------------------------------------------------------

describe("duplicateOrderSchema", () => {
  it("{ includeStops: true, includeItems: false, resetStatusToDraft: true } → OK", () => {
    const result = duplicateOrderSchema.parse({
      includeStops: true,
      includeItems: false,
      resetStatusToDraft: true,
    });
    expect(result.includeStops).toBe(true);
  });

  it("{} → ZodError (brak wymaganych pól)", () => {
    expect(() => duplicateOrderSchema.parse({})).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// carrierCellColorSchema
// ---------------------------------------------------------------------------

describe("carrierCellColorSchema", () => {
  it('{ color: "#48A111" } → OK', () => {
    const result = carrierCellColorSchema.parse({ color: "#48A111" });
    expect(result.color).toBe("#48A111");
  });

  it('{ color: "#FF0000" } → ZodError (nie w ALLOWED)', () => {
    expect(() =>
      carrierCellColorSchema.parse({ color: "#FF0000" })
    ).toThrow(ZodError);
  });

  it("{ color: null } → OK", () => {
    const result = carrierCellColorSchema.parse({ color: null });
    expect(result.color).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// patchStopSchema
// ---------------------------------------------------------------------------

describe("patchStopSchema", () => {
  it("{} → OK (wszystko opcjonalne)", () => {
    const result = patchStopSchema.parse({});
    expect(result).toEqual({});
  });

  it('{ kind: "INVALID" } → ZodError', () => {
    expect(() => patchStopSchema.parse({ kind: "INVALID" })).toThrow(ZodError);
  });

  it("{ kind: 'LOADING', dateLocal: '2026-02-20' } → OK", () => {
    const result = patchStopSchema.parse({ kind: "LOADING", dateLocal: "2026-02-20" });
    expect(result.kind).toBe("LOADING");
    expect(result.dateLocal).toBe("2026-02-20");
  });
});

// ---------------------------------------------------------------------------
// prepareEmailSchema
// ---------------------------------------------------------------------------

describe("prepareEmailSchema", () => {
  it("{} → { forceRegeneratePdf: false }", () => {
    const result = prepareEmailSchema.parse({});
    expect(result.forceRegeneratePdf).toBe(false);
  });

  it("{ forceRegeneratePdf: true } → OK", () => {
    const result = prepareEmailSchema.parse({ forceRegeneratePdf: true });
    expect(result.forceRegeneratePdf).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// dictionarySyncSchema
// ---------------------------------------------------------------------------

describe("dictionarySyncSchema", () => {
  it('{ resources: ["COMPANIES"] } → OK', () => {
    const result = dictionarySyncSchema.parse({ resources: ["COMPANIES"] });
    expect(result.resources).toEqual(["COMPANIES"]);
  });

  it("{ resources: [] } → ZodError (min 1)", () => {
    expect(() =>
      dictionarySyncSchema.parse({ resources: [] })
    ).toThrow(ZodError);
  });

  it('{ resources: ["INVALID"] } → ZodError', () => {
    expect(() =>
      dictionarySyncSchema.parse({ resources: ["INVALID"] })
    ).toThrow(ZodError);
  });

  it("wiele zasobów → OK", () => {
    const result = dictionarySyncSchema.parse({
      resources: ["COMPANIES", "LOCATIONS", "PRODUCTS"],
    });
    expect(result.resources).toHaveLength(3);
  });
});
