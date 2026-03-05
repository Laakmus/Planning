/**
 * Testy stałych i eksportów z view-models.ts.
 * Pure data — zero mocków, zero efektów ubocznych.
 */

import { describe, it, expect } from "vitest";
import {
  ALLOWED_MANUAL_STATUS_TRANSITIONS,
  DEFAULT_FILTERS,
  DEFAULT_PAGE_SIZES,
} from "../view-models";
import type {
  OrderStatusCode,
  ViewGroup,
  TransportTypeCode,
  CurrencyCode,
  StopKind,
  OrderSortBy,
  SortDirection,
  DictionarySyncResource,
  ListViewMode,
  LoadingMethodCode,
  OrderListFilters,
  OrderFormStop,
  OrderFormItem,
  OrderFormData,
  TimelineEntryViewModel,
  DictionaryState,
  ContextMenuState,
} from "../view-models";

// ---------------------------------------------------------------------------
// ALLOWED_MANUAL_STATUS_TRANSITIONS
// ---------------------------------------------------------------------------

describe("ALLOWED_MANUAL_STATUS_TRANSITIONS", () => {
  // Wszystkie 7 kodów statusów zdefiniowanych w PRD
  const ALL_STATUS_CODES: OrderStatusCode[] = [
    "robocze",
    "wysłane",
    "korekta",
    "korekta wysłane",
    "reklamacja",
    "zrealizowane",
    "anulowane",
  ];

  it("contains all 7 status codes as keys", () => {
    const keys = Object.keys(ALLOWED_MANUAL_STATUS_TRANSITIONS);
    expect(keys).toHaveLength(7);
    for (const code of ALL_STATUS_CODES) {
      expect(keys).toContain(code);
    }
  });

  // ---------------------------------------------------------------------------
  // Statusy z przejściami
  // ---------------------------------------------------------------------------

  it("robocze → [zrealizowane, anulowane]", () => {
    expect(ALLOWED_MANUAL_STATUS_TRANSITIONS["robocze"]).toEqual(["zrealizowane", "anulowane"]);
  });

  it("wysłane → [zrealizowane, reklamacja, anulowane]", () => {
    expect(ALLOWED_MANUAL_STATUS_TRANSITIONS["wysłane"]).toEqual([
      "zrealizowane",
      "reklamacja",
      "anulowane",
    ]);
  });

  it("korekta → [zrealizowane, reklamacja, anulowane]", () => {
    expect(ALLOWED_MANUAL_STATUS_TRANSITIONS["korekta"]).toEqual([
      "zrealizowane",
      "reklamacja",
      "anulowane",
    ]);
  });

  it("korekta wysłane → [zrealizowane, reklamacja, anulowane]", () => {
    expect(ALLOWED_MANUAL_STATUS_TRANSITIONS["korekta wysłane"]).toEqual([
      "zrealizowane",
      "reklamacja",
      "anulowane",
    ]);
  });

  it("reklamacja → [zrealizowane, anulowane]", () => {
    expect(ALLOWED_MANUAL_STATUS_TRANSITIONS["reklamacja"]).toEqual(["zrealizowane", "anulowane"]);
  });

  // ---------------------------------------------------------------------------
  // Statusy terminalne — brak ręcznych przejść
  // ---------------------------------------------------------------------------

  it("zrealizowane → [] (no manual transitions)", () => {
    expect(ALLOWED_MANUAL_STATUS_TRANSITIONS["zrealizowane"]).toEqual([]);
  });

  it("anulowane → [] (no manual transitions)", () => {
    expect(ALLOWED_MANUAL_STATUS_TRANSITIONS["anulowane"]).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Statusy "wysłane" i "korekta wysłane" NIE są celami ręcznych zmian
  // (ustawiane wyłącznie przez prepare-email)
  // ---------------------------------------------------------------------------

  it("wysłane is not a target in any manual transition", () => {
    for (const targets of Object.values(ALLOWED_MANUAL_STATUS_TRANSITIONS)) {
      expect(targets).not.toContain("wysłane");
    }
  });

  it("korekta wysłane is not a target in any manual transition", () => {
    for (const targets of Object.values(ALLOWED_MANUAL_STATUS_TRANSITIONS)) {
      expect(targets).not.toContain("korekta wysłane");
    }
  });

  // ---------------------------------------------------------------------------
  // Sprawdzenie poprawności typów (wszystkie elementy tablic są OrderStatusCode)
  // ---------------------------------------------------------------------------

  it("all target status codes are valid OrderStatusCode values", () => {
    for (const targets of Object.values(ALLOWED_MANUAL_STATUS_TRANSITIONS)) {
      for (const target of targets) {
        expect(ALL_STATUS_CODES).toContain(target);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Korekta i wysłane mają identyczne przejścia (PRD symetria)
  // ---------------------------------------------------------------------------

  it("korekta and wysłane have identical target transitions", () => {
    expect(ALLOWED_MANUAL_STATUS_TRANSITIONS["korekta"]).toEqual(
      ALLOWED_MANUAL_STATUS_TRANSITIONS["wysłane"]
    );
  });

  it("korekta wysłane and wysłane have identical target transitions", () => {
    expect(ALLOWED_MANUAL_STATUS_TRANSITIONS["korekta wysłane"]).toEqual(
      ALLOWED_MANUAL_STATUS_TRANSITIONS["wysłane"]
    );
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_FILTERS
// ---------------------------------------------------------------------------

describe("DEFAULT_FILTERS", () => {
  it("view defaults to CURRENT", () => {
    expect(DEFAULT_FILTERS.view).toBe("CURRENT");
  });

  it("sortBy defaults to FIRST_LOADING_DATETIME", () => {
    expect(DEFAULT_FILTERS.sortBy).toBe("FIRST_LOADING_DATETIME");
  });

  it("sortDirection defaults to ASC", () => {
    expect(DEFAULT_FILTERS.sortDirection).toBe("ASC");
  });

  it("pageSize defaults to 50", () => {
    expect(DEFAULT_FILTERS.pageSize).toBe(50);
  });

  it("optional filters are undefined by default", () => {
    // Pola opcjonalne nie powinny mieć wartości domyślnych
    expect(DEFAULT_FILTERS.transportType).toBeUndefined();
    expect(DEFAULT_FILTERS.status).toBeUndefined();
    expect(DEFAULT_FILTERS.carrierId).toBeUndefined();
    expect(DEFAULT_FILTERS.productId).toBeUndefined();
    expect(DEFAULT_FILTERS.loadingLocationId).toBeUndefined();
    expect(DEFAULT_FILTERS.loadingCompanyId).toBeUndefined();
    expect(DEFAULT_FILTERS.unloadingLocationId).toBeUndefined();
    expect(DEFAULT_FILTERS.unloadingCompanyId).toBeUndefined();
    expect(DEFAULT_FILTERS.weekNumber).toBeUndefined();
    expect(DEFAULT_FILTERS.dateFrom).toBeUndefined();
    expect(DEFAULT_FILTERS.dateTo).toBeUndefined();
    expect(DEFAULT_FILTERS.search).toBeUndefined();
  });

  it("is a valid OrderListFilters object (structural check)", () => {
    // Weryfikacja że obiekt spełnia wymagane pola interfejsu
    const filters: OrderListFilters = DEFAULT_FILTERS;
    expect(typeof filters.view).toBe("string");
    expect(typeof filters.sortBy).toBe("string");
    expect(typeof filters.sortDirection).toBe("string");
    expect(typeof filters.pageSize).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_PAGE_SIZES
// ---------------------------------------------------------------------------

describe("DEFAULT_PAGE_SIZES", () => {
  it("contains exactly 3 options", () => {
    expect(DEFAULT_PAGE_SIZES).toHaveLength(3);
  });

  it("first option is 50", () => {
    expect(DEFAULT_PAGE_SIZES[0]).toBe(50);
  });

  it("second option is 100", () => {
    expect(DEFAULT_PAGE_SIZES[1]).toBe(100);
  });

  it("third option is 200", () => {
    expect(DEFAULT_PAGE_SIZES[2]).toBe(200);
  });

  it("default pageSize is the first option", () => {
    // DEFAULT_FILTERS.pageSize musi być jedną z dostępnych opcji
    expect(DEFAULT_PAGE_SIZES).toContain(DEFAULT_FILTERS.pageSize);
    expect(DEFAULT_FILTERS.pageSize).toBe(DEFAULT_PAGE_SIZES[0]);
  });

  it("values are in ascending order", () => {
    const sorted = [...DEFAULT_PAGE_SIZES].sort((a, b) => a - b);
    expect([...DEFAULT_PAGE_SIZES]).toEqual(sorted);
  });
});

// ---------------------------------------------------------------------------
// Interface exports — weryfikacja że typy są eksportowane (compile-time check)
// Testy runtime potwierdzają poprawność struktury obiektów zgodnych z interfejsami.
// ---------------------------------------------------------------------------

describe("Interface structural compatibility", () => {
  it("OrderFormStop interface accepts valid stop object", () => {
    const stop: OrderFormStop = {
      id: null,
      kind: "LOADING",
      sequenceNo: 1,
      dateLocal: null,
      timeLocal: null,
      locationId: null,
      locationNameSnapshot: null,
      companyNameSnapshot: null,
      addressSnapshot: null,
      notes: null,
      _deleted: false,
    };
    // Jeśli obiekt przeszedł kompilację TypeScript — interfejs jest zgodny
    expect(stop.kind).toBe("LOADING");
    expect(stop._deleted).toBe(false);
  });

  it("OrderFormStop accepts UNLOADING kind", () => {
    const stop: OrderFormStop = {
      id: "uuid-1",
      kind: "UNLOADING",
      sequenceNo: 2,
      dateLocal: "2026-03-05",
      timeLocal: "14:00",
      locationId: "loc-uuid",
      locationNameSnapshot: "Berlin",
      companyNameSnapshot: "Firma XYZ",
      addressSnapshot: "Ulica 1",
      notes: "Uwagi",
      _deleted: false,
    };
    expect(stop.kind).toBe("UNLOADING");
    expect(stop.id).toBe("uuid-1");
  });

  it("OrderFormItem interface accepts valid item object", () => {
    const item: OrderFormItem = {
      id: null,
      productId: null,
      productNameSnapshot: null,
      defaultLoadingMethodSnapshot: null,
      loadingMethodCode: null,
      quantityTons: null,
      notes: null,
      _deleted: false,
    };
    expect(item._deleted).toBe(false);
    expect(item.id).toBeNull();
  });

  it("OrderFormItem accepts populated item", () => {
    const item: OrderFormItem = {
      id: "item-uuid",
      productId: "prod-uuid",
      productNameSnapshot: "Ruda żelaza",
      defaultLoadingMethodSnapshot: "PALETA",
      loadingMethodCode: "LUZEM",
      quantityTons: 24.5,
      notes: "Uwagi do towaru",
      _deleted: false,
    };
    expect(item.quantityTons).toBe(24.5);
    expect(item.loadingMethodCode).toBe("LUZEM");
  });

  it("TimelineEntryViewModel accepts status_change entry", () => {
    const entry: TimelineEntryViewModel = {
      id: "entry-uuid",
      type: "status_change",
      changedAt: "2026-03-05T10:00:00.000Z",
      changedByUserName: "Jan Kowalski",
      changedByUserId: "user-uuid",
      oldStatusCode: "robocze",
      newStatusCode: "wysłane",
    };
    expect(entry.type).toBe("status_change");
    expect(entry.newStatusCode).toBe("wysłane");
  });

  it("TimelineEntryViewModel accepts field_change entry", () => {
    const entry: TimelineEntryViewModel = {
      id: "entry-uuid-2",
      type: "field_change",
      changedAt: "2026-03-05T11:00:00.000Z",
      changedByUserName: null,
      changedByUserId: "user-uuid",
      fieldName: "generalNotes",
      oldValue: "Stara wartość",
      newValue: "Nowa wartość",
    };
    expect(entry.type).toBe("field_change");
    expect(entry.fieldName).toBe("generalNotes");
  });

  it("TimelineEntryViewModel accepts order_created entry", () => {
    const entry: TimelineEntryViewModel = {
      id: "entry-uuid-3",
      type: "order_created",
      changedAt: "2026-03-05T09:00:00.000Z",
      changedByUserName: "Admin",
      changedByUserId: "admin-uuid",
    };
    expect(entry.type).toBe("order_created");
  });

  it("ContextMenuState accepts valid state", () => {
    const state: ContextMenuState = {
      orderId: null,
      position: { x: 0, y: 0 },
      isOpen: false,
    };
    expect(state.isOpen).toBe(false);
    expect(state.orderId).toBeNull();
  });

  it("ContextMenuState accepts open state with orderId", () => {
    const state: ContextMenuState = {
      orderId: "order-uuid",
      position: { x: 150, y: 300 },
      isOpen: true,
    };
    expect(state.isOpen).toBe(true);
    expect(state.position.x).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// Type union literals — weryfikacja wartości dopuszczalnych przez każdy union
// ---------------------------------------------------------------------------

describe("Type union values", () => {
  it("ViewGroup accepts CURRENT, COMPLETED, CANCELLED", () => {
    const groups: ViewGroup[] = ["CURRENT", "COMPLETED", "CANCELLED"];
    expect(groups).toHaveLength(3);
  });

  it("TransportTypeCode accepts PL, EXP, EXP_K, IMP", () => {
    const codes: TransportTypeCode[] = ["PL", "EXP", "EXP_K", "IMP"];
    expect(codes).toHaveLength(4);
  });

  it("CurrencyCode accepts PLN, EUR, USD", () => {
    const currencies: CurrencyCode[] = ["PLN", "EUR", "USD"];
    expect(currencies).toHaveLength(3);
  });

  it("StopKind accepts LOADING and UNLOADING", () => {
    const kinds: StopKind[] = ["LOADING", "UNLOADING"];
    expect(kinds).toHaveLength(2);
  });

  it("SortDirection accepts ASC and DESC", () => {
    const directions: SortDirection[] = ["ASC", "DESC"];
    expect(directions).toHaveLength(2);
  });

  it("OrderSortBy accepts 4 valid sort fields", () => {
    const sortFields: OrderSortBy[] = [
      "FIRST_LOADING_DATETIME",
      "FIRST_UNLOADING_DATETIME",
      "ORDER_NO",
      "CARRIER_NAME",
    ];
    expect(sortFields).toHaveLength(4);
  });

  it("DictionarySyncResource accepts COMPANIES, LOCATIONS, PRODUCTS", () => {
    const resources: DictionarySyncResource[] = ["COMPANIES", "LOCATIONS", "PRODUCTS"];
    expect(resources).toHaveLength(3);
  });

  it("ListViewMode accepts route and columns", () => {
    const modes: ListViewMode[] = ["route", "columns"];
    expect(modes).toHaveLength(2);
  });

  it("LoadingMethodCode accepts 4 valid codes", () => {
    const codes: LoadingMethodCode[] = ["PALETA", "PALETA_BIGBAG", "LUZEM", "KOSZE"];
    expect(codes).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Spójność danych — krzyżowe sprawdzenia między stałymi
// ---------------------------------------------------------------------------

describe("Data consistency", () => {
  it("all transition target arrays contain only non-email-set statuses", () => {
    // "wysłane" i "korekta wysłane" są ustawiane przez prepare-email, nie ręcznie
    const emailSetStatuses: OrderStatusCode[] = ["wysłane", "korekta wysłane"];
    for (const [source, targets] of Object.entries(ALLOWED_MANUAL_STATUS_TRANSITIONS)) {
      for (const target of targets) {
        expect(emailSetStatuses).not.toContain(target);
      }
      void source; // source jest używany implicite w iteracji
    }
  });

  it("terminal statuses (zrealizowane, anulowane) have no outgoing manual transitions", () => {
    expect(ALLOWED_MANUAL_STATUS_TRANSITIONS["zrealizowane"]).toHaveLength(0);
    expect(ALLOWED_MANUAL_STATUS_TRANSITIONS["anulowane"]).toHaveLength(0);
  });

  it("non-terminal statuses all have at least one outgoing transition", () => {
    const nonTerminal: OrderStatusCode[] = [
      "robocze",
      "wysłane",
      "korekta",
      "korekta wysłane",
      "reklamacja",
    ];
    for (const status of nonTerminal) {
      expect(ALLOWED_MANUAL_STATUS_TRANSITIONS[status].length).toBeGreaterThan(0);
    }
  });

  it("zrealizowane is always a possible target (all non-terminal statuses can reach it)", () => {
    const nonTerminal: OrderStatusCode[] = [
      "robocze",
      "wysłane",
      "korekta",
      "korekta wysłane",
      "reklamacja",
    ];
    for (const status of nonTerminal) {
      expect(ALLOWED_MANUAL_STATUS_TRANSITIONS[status]).toContain("zrealizowane");
    }
  });

  it("anulowane is always a possible target (all non-terminal statuses can reach it)", () => {
    const nonTerminal: OrderStatusCode[] = [
      "robocze",
      "wysłane",
      "korekta",
      "korekta wysłane",
      "reklamacja",
    ];
    for (const status of nonTerminal) {
      expect(ALLOWED_MANUAL_STATUS_TRANSITIONS[status]).toContain("anulowane");
    }
  });

  it("reklamacja is only reachable from wysłane, korekta, korekta wysłane", () => {
    // robocze i reklamacja NIE mogą przejść do reklamacja
    expect(ALLOWED_MANUAL_STATUS_TRANSITIONS["robocze"]).not.toContain("reklamacja");
    expect(ALLOWED_MANUAL_STATUS_TRANSITIONS["reklamacja"]).not.toContain("reklamacja");
    // wysłane, korekta, korekta wysłane — mogą
    expect(ALLOWED_MANUAL_STATUS_TRANSITIONS["wysłane"]).toContain("reklamacja");
    expect(ALLOWED_MANUAL_STATUS_TRANSITIONS["korekta"]).toContain("reklamacja");
    expect(ALLOWED_MANUAL_STATUS_TRANSITIONS["korekta wysłane"]).toContain("reklamacja");
  });

  it("DEFAULT_FILTERS.pageSize is included in DEFAULT_PAGE_SIZES", () => {
    expect(DEFAULT_PAGE_SIZES).toContain(DEFAULT_FILTERS.pageSize);
  });

  it("DEFAULT_FILTERS.view is a valid ViewGroup", () => {
    const validGroups: ViewGroup[] = ["CURRENT", "COMPLETED", "CANCELLED"];
    expect(validGroups).toContain(DEFAULT_FILTERS.view);
  });

  it("DEFAULT_FILTERS.sortBy is a valid OrderSortBy", () => {
    const validSortFields: OrderSortBy[] = [
      "FIRST_LOADING_DATETIME",
      "FIRST_UNLOADING_DATETIME",
      "ORDER_NO",
      "CARRIER_NAME",
    ];
    expect(validSortFields).toContain(DEFAULT_FILTERS.sortBy);
  });

  it("DEFAULT_FILTERS.sortDirection is a valid SortDirection", () => {
    const validDirections: SortDirection[] = ["ASC", "DESC"];
    expect(validDirections).toContain(DEFAULT_FILTERS.sortDirection);
  });
});
