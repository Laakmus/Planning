/**
 * Wspólne stałe UUID i fabryki danych testowych.
 * Używane we wszystkich testach serwisów.
 */

// ---------------------------------------------------------------------------
// Stałe UUID
// ---------------------------------------------------------------------------

export const VALID_USER_ID = "a0000000-0000-0000-0000-000000000001";
export const ADMIN_USER_ID = "a0000000-0000-0000-0000-000000000002";
export const OTHER_USER_ID = "a0000000-0000-0000-0000-000000000003";

export const VALID_ORDER_ID = "b0000000-0000-0000-0000-000000000001";
export const VALID_STOP_ID = "c0000000-0000-0000-0000-000000000001";
export const VALID_LOCATION_ID = "d0000000-0000-0000-0000-000000000001";
export const VALID_PRODUCT_ID = "e0000000-0000-0000-0000-000000000001";
export const VALID_COMPANY_ID = "f0000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Fabryki — minimalne wiersze z domyślnymi wartościami
// ---------------------------------------------------------------------------

/** Minimalny wiersz transport_orders (snake_case, jak w DB). */
export function makeOrderRow(overrides?: Record<string, unknown>) {
  return {
    id: VALID_ORDER_ID,
    order_no: "ZT2026/0001",
    status_code: "robocze",
    transport_type_code: "PL",
    currency_code: "PLN",
    vehicle_variant_code: null,
    vehicle_type_text: null,
    vehicle_capacity_volume_m3: null,
    carrier_company_id: null,
    carrier_name_snapshot: null,
    carrier_address_snapshot: null,
    carrier_location_name_snapshot: null,
    shipper_location_id: null,
    shipper_name_snapshot: null,
    shipper_address_snapshot: null,
    receiver_location_id: null,
    receiver_name_snapshot: null,
    receiver_address_snapshot: null,
    price_amount: null,
    total_load_tons: null,
    summary_route: null,
    first_loading_date: null,
    first_loading_time: null,
    first_unloading_date: null,
    first_unloading_time: null,
    first_loading_country: null,
    first_unloading_country: null,
    transport_year: 2026,
    main_product_name: null,
    required_documents_text: null,
    general_notes: null,
    complaint_reason: null,
    sender_contact_name: null,
    sender_contact_phone: null,
    sender_contact_email: null,
    search_text: "ZT2026/0001",
    locked_by_user_id: null,
    locked_at: null,
    created_at: "2026-02-17T10:00:00.000Z",
    created_by_user_id: VALID_USER_ID,
    updated_at: "2026-02-17T10:00:00.000Z",
    updated_by_user_id: null,
    ...overrides,
  };
}

/** Minimalny wiersz order_stops (snake_case). */
export function makeStopRow(overrides?: Record<string, unknown>) {
  return {
    id: VALID_STOP_ID,
    order_id: VALID_ORDER_ID,
    kind: "LOADING",
    sequence_no: 1,
    date_local: "2026-02-20",
    time_local: "08:00",
    location_id: VALID_LOCATION_ID,
    location_name_snapshot: "Magazyn Centralny",
    company_name_snapshot: "NordMetal",
    address_snapshot: "ul. Testowa 1, 00-001 Warszawa, PL",
    notes: null,
    ...overrides,
  };
}

/** Minimalny wiersz order_items (snake_case). */
export function makeItemRow(overrides?: Record<string, unknown>) {
  return {
    id: "e1000000-0000-0000-0000-000000000001",
    order_id: VALID_ORDER_ID,
    product_id: VALID_PRODUCT_ID,
    product_name_snapshot: "Stal nierdzewna",
    default_loading_method_snapshot: "PALETA",
    loading_method_code: "PALETA",
    quantity_tons: 10,
    notes: null,
    ...overrides,
  };
}

/** Minimalne parametry createOrder (camelCase, walidowane przez Zod). */
export function makeCreateOrderParams(overrides?: Record<string, unknown>) {
  return {
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
    confidentialityClause: null,
    senderContactName: null,
    senderContactPhone: null,
    senderContactEmail: null,
    stops: [
      { kind: "LOADING" as const, dateLocal: "2026-02-20", timeLocal: "08:00", locationId: null, notes: null },
      { kind: "UNLOADING" as const, dateLocal: "2026-02-21", timeLocal: "14:00", locationId: null, notes: null },
    ],
    items: [],
    ...overrides,
  };
}

/** Minimalne parametry updateOrder (camelCase, walidowane przez Zod). */
export function makeUpdateOrderParams(overrides?: Record<string, unknown>) {
  return {
    ...makeCreateOrderParams(),
    complaintReason: null,
    stops: [
      { id: VALID_STOP_ID, kind: "LOADING" as const, dateLocal: "2026-02-20", timeLocal: "08:00", locationId: null, notes: null, sequenceNo: 1, _deleted: false },
      { id: null, kind: "UNLOADING" as const, dateLocal: "2026-02-21", timeLocal: "14:00", locationId: null, notes: null, sequenceNo: 2, _deleted: false },
    ],
    items: [],
    ...overrides,
  };
}
