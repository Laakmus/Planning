/**
 * Serwis zleceń transportowych — lista, szczegóły, CRUD.
 * listOrders: GET /api/v1/orders z filtrami, sortowaniem i paginacją.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types";
import type {
  CreateOrderResponseDto,
  DuplicateOrderResponseDto,
  OrderDetailResponseDto,
  OrderListItemDto,
  OrderListItemInnerDto,
  OrderListResponseDto,
  OrderListStopDto,
  PatchStopResponseDto,
  PrepareEmailResponseDto,
  UpdateOrderResponseDto,
} from "../../types";
import type {
  CreateOrderParams,
  DuplicateOrderParams,
  OrderListQueryParams,
  PatchStopParams,
  PrepareEmailParams,
  UpdateOrderParams,
} from "../validators/order.validator";

/** Wiersz transport_orders z joinami (order_statuses, transport_types, user_profiles). */
type TransportOrderRow = Database["public"]["Tables"]["transport_orders"]["Row"] & {
  order_statuses: { name: string; view_group: string } | null;
  transport_types: { name: string } | null;
  created_by_user: { full_name: string | null } | null;
  updated_by_user: { full_name: string | null } | null;
  sent_by_user: { full_name: string | null } | null;
  locked_by_user: { full_name: string | null } | null;
};

/** Kolumny do sortowania (pole DB). */
const SORT_COLUMN: Record<
  OrderListQueryParams["sortBy"],
  keyof Database["public"]["Tables"]["transport_orders"]["Row"]
> = {
  FIRST_LOADING_DATETIME: "first_loading_date",
  FIRST_UNLOADING_DATETIME: "first_unloading_date",
  ORDER_NO: "order_seq_no",
  CARRIER_NAME: "carrier_name_snapshot",
};

/**
 * Mapuje wiersz z joinami na OrderListItemDto.
 * Kolumny last_loading_* / last_unloading_* mogą być w DB (migracja) — odczyt z rozszerzonego wiersza.
 */
function mapRowToOrderListItemDto(
  row: TransportOrderRow & {
    last_loading_date?: string | null;
    last_loading_time?: string | null;
    last_unloading_date?: string | null;
    last_unloading_time?: string | null;
    week_number?: number | null;
    vehicle_capacity_volume_m3?: number | null;
    sent_at?: string | null;
    carrier_cell_color?: string | null;
    is_entry_fixed?: boolean | null;
  },
  stops: OrderListStopDto[],
  items: OrderListItemInnerDto[]
): OrderListItemDto {
  return {
    id: row.id,
    orderNo: row.order_no,
    statusCode: row.status_code,
    statusName: row.order_statuses?.name ?? "",
    viewGroup: row.order_statuses?.view_group ?? "",
    transportTypeCode: row.transport_type_code,
    transportTypeName: row.transport_types?.name ?? "",
    summaryRoute: row.summary_route,
    stops,
    firstLoadingDate: row.first_loading_date,
    firstLoadingTime: row.first_loading_time,
    firstUnloadingDate: row.first_unloading_date,
    firstUnloadingTime: row.first_unloading_time,
    lastLoadingDate: row.last_loading_date ?? null,
    lastLoadingTime: row.last_loading_time ?? null,
    lastUnloadingDate: row.last_unloading_date ?? null,
    lastUnloadingTime: row.last_unloading_time ?? null,
    weekNumber: row.week_number ?? null,
    carrierCompanyId: row.carrier_company_id,
    carrierName: row.carrier_name_snapshot,
    mainProductName: row.main_product_name ?? null,
    items,
    priceAmount: row.price_amount,
    currencyCode: row.currency_code,
    vehicleTypeText: row.vehicle_type_text ?? null,
    vehicleCapacityVolumeM3: row.vehicle_capacity_volume_m3 ?? null,
    requiredDocumentsText: row.required_documents_text,
    generalNotes: row.general_notes,
    sentByUserName: row.sent_by_user?.full_name ?? null,
    sentAt: row.sent_at ?? null,
    lockedByUserId: row.locked_by_user_id,
    lockedByUserName: row.locked_by_user?.full_name ?? null,
    lockedAt: row.locked_at,
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id,
    createdByUserName: row.created_by_user?.full_name ?? null,
    updatedAt: row.updated_at,
    updatedByUserId: row.updated_by_user_id,
    updatedByUserName: row.updated_by_user?.full_name ?? null,
    carrierCellColor: row.carrier_cell_color ?? null,
    isEntryFixed: row.is_entry_fixed ?? null,
  };
}

/**
 * Pobiera listę zleceń z filtrami, sortowaniem i paginacją.
 * Filtry productId, loadingLocationId, loadingCompanyId, unloadingLocationId, unloadingCompanyId
 * wymagają sub-query / RPC — na razie nie są stosowane (można dodać w kolejnej iteracji).
 *
 * @param supabase — klient Supabase
 * @param params — parametry z walidowanego query (orderListQuerySchema)
 */
export async function listOrders(
  supabase: SupabaseClient<Database>,
  params: OrderListQueryParams
): Promise<OrderListResponseDto> {
  const {
    view,
    status,
    transportType,
    carrierId,
    productId,
    loadingLocationId,
    loadingCompanyId,
    unloadingLocationId,
    unloadingCompanyId,
    search,
    dateFrom,
    dateTo,
    sortBy,
    sortDirection,
    page,
    pageSize,
  } = params;

  const sortColumn = SORT_COLUMN[sortBy];
  const ascending = sortDirection === "ASC";

  const { data: statusRows } = await supabase
    .from("order_statuses")
    .select("code")
    .eq("view_group", view);
  let statusCodes = (statusRows ?? []).map((r) => r.code);
  if (status !== undefined) {
    const requested: string[] = Array.isArray(status) ? status : [status];
    statusCodes = statusCodes.filter((c) => requested.includes(c));
  }
  if (statusCodes.length === 0) {
    return { items: [], page, pageSize, totalItems: 0, totalPages: 1 };
  }

  // Sub-query filters: collect order_ids matching advanced filters
  let subQueryOrderIds: string[] | null = null;

  if (productId || loadingLocationId || loadingCompanyId || unloadingLocationId || unloadingCompanyId) {
    // Run all independent filter queries in parallel
    const filterPromises: Array<Promise<Set<string>>> = [];

    if (productId) {
      filterPromises.push(
        Promise.resolve(
          supabase
            .from("order_items")
            .select("order_id")
            .eq("product_id", productId)
        ).then(({ data }) => new Set((data ?? []).map((r) => r.order_id)))
      );
    }

    if (loadingLocationId) {
      filterPromises.push(
        Promise.resolve(
          supabase
            .from("order_stops")
            .select("order_id")
            .eq("location_id", loadingLocationId)
            .eq("kind", "LOADING")
        ).then(({ data }) => new Set((data ?? []).map((r) => r.order_id)))
      );
    }

    if (unloadingLocationId) {
      filterPromises.push(
        Promise.resolve(
          supabase
            .from("order_stops")
            .select("order_id")
            .eq("location_id", unloadingLocationId)
            .eq("kind", "UNLOADING")
        ).then(({ data }) => new Set((data ?? []).map((r) => r.order_id)))
      );
    }

    if (loadingCompanyId) {
      filterPromises.push(
        Promise.resolve(
          supabase
            .from("locations")
            .select("id")
            .eq("company_id", loadingCompanyId)
        ).then(async ({ data: locs }) => {
            const locIds = (locs ?? []).map((l) => l.id);
            if (locIds.length === 0) return new Set<string>();
            const { data: stopRows } = await supabase
              .from("order_stops")
              .select("order_id")
              .in("location_id", locIds)
              .eq("kind", "LOADING");
            return new Set((stopRows ?? []).map((r) => r.order_id));
          })
      );
    }

    if (unloadingCompanyId) {
      filterPromises.push(
        Promise.resolve(
          supabase
            .from("locations")
            .select("id")
            .eq("company_id", unloadingCompanyId)
        ).then(async ({ data: locs }) => {
            const locIds = (locs ?? []).map((l) => l.id);
            if (locIds.length === 0) return new Set<string>();
            const { data: stopRows } = await supabase
              .from("order_stops")
              .select("order_id")
              .in("location_id", locIds)
              .eq("kind", "UNLOADING");
            return new Set((stopRows ?? []).map((r) => r.order_id));
          })
      );
    }

    // Run all filter queries in parallel, then intersect results
    const idSets = await Promise.all(filterPromises);

    if (idSets.length > 0) {
      let result = idSets[0];
      for (let i = 1; i < idSets.length; i++) {
        result = new Set([...result].filter((id) => idSets[i].has(id)));
      }
      subQueryOrderIds = [...result];
    }

    if (subQueryOrderIds && subQueryOrderIds.length === 0) {
      return { items: [], page, pageSize, totalItems: 0, totalPages: 1 };
    }
  }

  const selectColumns = `
    *,
    order_statuses(name, view_group),
    transport_types(name),
    created_by_user:user_profiles!transport_orders_created_by_user_id_fkey(full_name),
    updated_by_user:user_profiles!transport_orders_updated_by_user_id_fkey(full_name),
    sent_by_user:user_profiles!transport_orders_sent_by_user_id_fkey(full_name),
    locked_by_user:user_profiles!transport_orders_locked_by_user_id_fkey(full_name)
  `.replace(/\s+/g, " ");

  let query = supabase
    .from("transport_orders")
    .select(selectColumns, { count: "exact" })
    .in("status_code", statusCodes);

  if (subQueryOrderIds) {
    query = query.in("id", subQueryOrderIds);
  }
  if (transportType !== undefined) {
    query = query.eq("transport_type_code", transportType);
  }
  if (carrierId !== undefined) {
    query = query.eq("carrier_company_id", carrierId);
  }
  if (search !== undefined && search.trim() !== "") {
    const escaped = search.trim().replace(/[%_\\]/g, "\\$&");
    query = query.ilike("search_text", `%${escaped}%`);
  }
  if (dateFrom !== undefined) {
    query = query.gte("first_loading_date", dateFrom);
  }
  if (dateTo !== undefined) {
    query = query.lte("first_loading_date", dateTo);
  }

  query = query
    .order(sortColumn, { ascending })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data: rows, error, count } = await query;

  if (error) {
    throw error;
  }

  const safeRows = (rows ?? []) as unknown as Array<{ id: string }>;
  const orderIds = safeRows.map((r) => r.id);

  // Fetch stops and items for the returned page in bulk
  const [stopsResult, itemsResult] = await Promise.all([
    orderIds.length > 0
      ? supabase
          .from("order_stops")
          .select("order_id, kind, sequence_no, company_name_snapshot, location_name_snapshot, date_local, time_local")
          .in("order_id", orderIds)
          .order("sequence_no", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    orderIds.length > 0
      ? supabase
          .from("order_items")
          .select("order_id, product_name_snapshot, quantity_tons, loading_method_code, notes")
          .in("order_id", orderIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (stopsResult.error) throw stopsResult.error;
  if (itemsResult.error) throw itemsResult.error;

  // Group stops and items by order_id
  const stopsByOrderId = new Map<string, OrderListStopDto[]>();
  for (const s of stopsResult.data ?? []) {
    const list = stopsByOrderId.get(s.order_id) ?? [];
    list.push({
      kind: s.kind,
      sequenceNo: s.sequence_no,
      companyNameSnapshot: s.company_name_snapshot ?? null,
      locationNameSnapshot: s.location_name_snapshot ?? null,
      dateLocal: s.date_local ?? null,
      timeLocal: s.time_local ?? null,
    });
    stopsByOrderId.set(s.order_id, list);
  }

  const itemsByOrderId = new Map<string, OrderListItemInnerDto[]>();
  for (const it of itemsResult.data ?? []) {
    const list = itemsByOrderId.get(it.order_id) ?? [];
    list.push({
      productNameSnapshot: it.product_name_snapshot ?? null,
      quantityTons: it.quantity_tons ?? null,
      loadingMethodCode: it.loading_method_code ?? null,
      notes: it.notes ?? null,
    });
    itemsByOrderId.set(it.order_id, list);
  }

  const mappedItems = safeRows.map((row) =>
    mapRowToOrderListItemDto(
      row as unknown as TransportOrderRow & Record<string, unknown>,
      stopsByOrderId.get(row.id) ?? [],
      itemsByOrderId.get(row.id) ?? []
    )
  );
  const totalItems = count ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  return {
    items: mappedItems,
    page,
    pageSize,
    totalItems,
    totalPages,
  };
}

/** Rozszerzony wiersz transport_orders (opcjonalne kolumny z migracji). */
type TransportOrderRowExtended = Database["public"]["Tables"]["transport_orders"]["Row"] & {
  payment_term_days?: number | null;
  payment_method?: string | null;
  total_load_volume_m3?: number | null;
  special_requirements?: string | null;
  last_loading_date?: string | null;
  last_loading_time?: string | null;
  last_unloading_date?: string | null;
  last_unloading_time?: string | null;
  week_number?: number | null;
  sent_at?: string | null;
  sent_by_user_id?: string | null;
};

/**
 * Pobiera pełne dane zlecenia (nagłówek + punkty trasy + pozycje).
 * Zwraca null, gdy zlecenie nie istnieje.
 *
 * @param supabase — klient Supabase
 * @param orderId — UUID zlecenia
 */
export async function getOrderDetail(
  supabase: SupabaseClient<Database>,
  orderId: string
): Promise<OrderDetailResponseDto | null> {
  const { data: orderRow, error: orderError } = await supabase
    .from("transport_orders")
    // select z JOINami — kolumny z migracji + powiązane tabele (api-plan §2.3)
    .select(`
      *,
      order_statuses!status_code ( name ),
      created_by:user_profiles!transport_orders_created_by_user_id_fkey ( full_name ),
      updated_by:user_profiles!transport_orders_updated_by_user_id_fkey ( full_name ),
      sent_by:user_profiles!transport_orders_sent_by_user_id_fkey ( full_name ),
      locked_by:user_profiles!transport_orders_locked_by_user_id_fkey ( full_name )
    `)
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!orderRow) return null;

  const row = orderRow as TransportOrderRowExtended;

  const order: OrderDetailResponseDto["order"] = {
    id: row.id,
    orderNo: row.order_no,
    statusCode: row.status_code,
    transportTypeCode: row.transport_type_code,
    currencyCode: row.currency_code,
    priceAmount: row.price_amount,
    paymentTermDays: row.payment_term_days ?? null,
    paymentMethod: row.payment_method ?? null,
    totalLoadTons: row.total_load_tons,
    totalLoadVolumeM3: row.total_load_volume_m3 ?? null,
    summaryRoute: row.summary_route,
    firstLoadingDate: row.first_loading_date,
    firstLoadingTime: row.first_loading_time,
    firstUnloadingDate: row.first_unloading_date,
    firstUnloadingTime: row.first_unloading_time,
    lastLoadingDate: row.last_loading_date ?? null,
    lastLoadingTime: row.last_loading_time ?? null,
    lastUnloadingDate: row.last_unloading_date ?? null,
    lastUnloadingTime: row.last_unloading_time ?? null,
    transportYear: row.transport_year,
    firstLoadingCountry: row.first_loading_country,
    firstUnloadingCountry: row.first_unloading_country,
    carrierCompanyId: row.carrier_company_id,
    carrierNameSnapshot: row.carrier_name_snapshot,
    carrierLocationNameSnapshot: row.carrier_location_name_snapshot,
    carrierAddressSnapshot: row.carrier_address_snapshot,
    shipperLocationId: row.shipper_location_id,
    shipperNameSnapshot: row.shipper_name_snapshot,
    shipperAddressSnapshot: row.shipper_address_snapshot,
    receiverLocationId: row.receiver_location_id,
    receiverNameSnapshot: row.receiver_name_snapshot,
    receiverAddressSnapshot: row.receiver_address_snapshot,
    vehicleTypeText: row.vehicle_type_text ?? null,
    vehicleCapacityVolumeM3: row.vehicle_capacity_volume_m3 ?? null,
    mainProductName: row.main_product_name ?? null,
    specialRequirements: row.special_requirements ?? null,
    requiredDocumentsText: row.required_documents_text,
    generalNotes: row.general_notes,
    complaintReason: row.complaint_reason,
    senderContactName: row.sender_contact_name,
    senderContactPhone: row.sender_contact_phone,
    senderContactEmail: row.sender_contact_email,
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id,
    updatedAt: row.updated_at,
    updatedByUserId: row.updated_by_user_id,
    lockedByUserId: row.locked_by_user_id,
    lockedAt: row.locked_at,
    // Pola z JOINów (api-plan §2.3)
    statusName: (row as any).order_statuses?.name ?? row.status_code,
    weekNumber: row.week_number ?? null,
    sentAt: row.sent_at ?? null,
    sentByUserName: (row as any).sent_by?.full_name ?? null,
    createdByUserName: (row as any).created_by?.full_name ?? null,
    updatedByUserName: (row as any).updated_by?.full_name ?? null,
    lockedByUserName: (row as any).locked_by?.full_name ?? null,
  };

  const { data: stopsRows } = await supabase
    .from("order_stops")
    .select("id, kind, sequence_no, date_local, time_local, location_id, location_name_snapshot, company_name_snapshot, address_snapshot, notes")
    .eq("order_id", orderId)
    .order("sequence_no", { ascending: true });

  const stops: OrderDetailResponseDto["stops"] = (stopsRows ?? []).map(
    (s) => ({
      id: s.id,
      kind: s.kind,
      sequenceNo: s.sequence_no,
      dateLocal: s.date_local,
      timeLocal: s.time_local,
      locationId: s.location_id,
      locationNameSnapshot: s.location_name_snapshot,
      companyNameSnapshot: s.company_name_snapshot,
      addressSnapshot: s.address_snapshot,
      notes: s.notes,
    })
  );

  const { data: itemsRows } = await supabase
    .from("order_items")
    .select("id, product_id, product_name_snapshot, default_loading_method_snapshot, loading_method_code, quantity_tons, notes")
    .eq("order_id", orderId);

  const items: OrderDetailResponseDto["items"] = (itemsRows ?? []).map(
    (i) => ({
      id: i.id,
      productId: i.product_id,
      productNameSnapshot: i.product_name_snapshot,
      defaultLoadingMethodSnapshot: i.default_loading_method_snapshot,
      loadingMethodCode: i.loading_method_code,
      quantityTons: i.quantity_tons,
      notes: i.notes,
    })
  );

  return { order, stops, items };
}

// ---------------------------------------------------------------------------
// Funkcje pomocnicze — snapshoty, denormalizacja, walidacja FK
// ---------------------------------------------------------------------------

/** Pobiera snapshot przewoźnika (firma) na podstawie companyId. */
async function buildSnapshotsForCarrier(
  supabase: SupabaseClient<Database>,
  companyId: string
): Promise<{
  carrier_name_snapshot: string | null;
  carrier_address_snapshot: string | null;
  carrier_location_name_snapshot: string | null;
}> {
  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();

  return {
    carrier_name_snapshot: company?.name ?? null,
    carrier_address_snapshot: null,
    carrier_location_name_snapshot: null,
  };
}

/** Pobiera snapshot lokalizacji (nazwa lokalizacji, nazwa firmy, adres). */
async function buildSnapshotsForLocation(
  supabase: SupabaseClient<Database>,
  locationId: string
): Promise<{
  locationNameSnapshot: string | null;
  companyNameSnapshot: string | null;
  addressSnapshot: string | null;
  country: string | null;
}> {
  const { data: loc } = await supabase
    .from("locations")
    .select("name, city, country, street_and_number, postal_code, company_id, companies(name)")
    .eq("id", locationId)
    .maybeSingle();

  if (!loc) {
    return { locationNameSnapshot: null, companyNameSnapshot: null, addressSnapshot: null, country: null };
  }

  const companyName = (loc.companies as { name: string } | null)?.name ?? null;
  const address = [loc.street_and_number, `${loc.postal_code} ${loc.city}`, loc.country]
    .filter(Boolean)
    .join(", ");

  return {
    locationNameSnapshot: loc.name,
    companyNameSnapshot: companyName,
    addressSnapshot: address || null,
    country: loc.country,
  };
}

/** Pobiera snapshot shipper/receiver (nazwa firmy + adres z lokalizacji). */
async function buildSnapshotsForShipperReceiver(
  supabase: SupabaseClient<Database>,
  locationId: string
): Promise<{ nameSnapshot: string | null; addressSnapshot: string | null }> {
  const snap = await buildSnapshotsForLocation(supabase, locationId);
  return {
    nameSnapshot: snap.companyNameSnapshot,
    addressSnapshot: snap.addressSnapshot,
  };
}

/** Batch: pobiera snapshoty lokalizacji dla wielu locationId naraz (1 query zamiast N). */
async function batchBuildSnapshotsForLocations(
  supabase: SupabaseClient<Database>,
  locationIds: string[]
): Promise<Map<string, { locationNameSnapshot: string | null; companyNameSnapshot: string | null; addressSnapshot: string | null; country: string | null }>> {
  const result = new Map<string, { locationNameSnapshot: string | null; companyNameSnapshot: string | null; addressSnapshot: string | null; country: string | null }>();
  if (locationIds.length === 0) return result;

  const uniqueIds = [...new Set(locationIds)];
  const { data: locs } = await supabase
    .from("locations")
    .select("id, name, city, country, street_and_number, postal_code, company_id, companies(name)")
    .in("id", uniqueIds);

  for (const loc of locs ?? []) {
    const companyName = (loc.companies as { name: string } | null)?.name ?? null;
    const address = [loc.street_and_number, `${loc.postal_code} ${loc.city}`, loc.country]
      .filter(Boolean)
      .join(", ");
    result.set(loc.id, {
      locationNameSnapshot: loc.name,
      companyNameSnapshot: companyName,
      addressSnapshot: address || null,
      country: loc.country,
    });
  }
  return result;
}

/** Batch: pobiera snapshoty produktów dla wielu productId naraz (1 query zamiast N). */
async function batchBuildSnapshotsForItems(
  supabase: SupabaseClient<Database>,
  productIds: string[]
): Promise<Map<string, { productNameSnapshot: string | null; defaultLoadingMethodSnapshot: string | null }>> {
  const result = new Map<string, { productNameSnapshot: string | null; defaultLoadingMethodSnapshot: string | null }>();
  if (productIds.length === 0) return result;

  const uniqueIds = [...new Set(productIds)];
  const { data: products } = await supabase
    .from("products")
    .select("id, name, default_loading_method_code")
    .in("id", uniqueIds);

  for (const p of products ?? []) {
    result.set(p.id, {
      productNameSnapshot: p.name ?? null,
      defaultLoadingMethodSnapshot: p.default_loading_method_code ?? null,
    });
  }
  return result;
}

/**
 * Oblicza pola denormalizowane z listy stops:
 * first/last loading/unloading date/time, first loading/unloading country, summary_route.
 */
function computeDenormalizedFields(
  stops: Array<{
    kind: string;
    dateLocal: string | null;
    timeLocal: string | null;
    locationNameSnapshot?: string | null;
    country?: string | null;
  }>,
  items: Array<{ productNameSnapshot: string | null }>
): {
  first_loading_date: string | null;
  first_loading_time: string | null;
  first_unloading_date: string | null;
  first_unloading_time: string | null;
  last_loading_date: string | null;
  last_loading_time: string | null;
  last_unloading_date: string | null;
  last_unloading_time: string | null;
  first_loading_country: string | null;
  first_unloading_country: string | null;
  summary_route: string | null;
  main_product_name: string | null;
  transport_year: number | null;
} {
  const loading = stops.filter((s) => s.kind === "LOADING");
  const unloading = stops.filter((s) => s.kind === "UNLOADING");

  const firstLoadingCountry = loading[0]?.country ?? null;
  const firstUnloadingCountry = unloading[0]?.country ?? null;

  // summary_route: "PL: Kęty → DE: Hamburg"
  const routeParts: string[] = [];
  for (const s of stops) {
    const name = s.locationNameSnapshot ?? "?";
    const country = s.country ?? "";
    routeParts.push(country ? `${country}: ${name}` : name);
  }
  const summaryRoute = routeParts.length > 0 ? routeParts.join(" → ") : null;

  const mainProductName = items.find((i) => i.productNameSnapshot?.trim())?.productNameSnapshot ?? null;

  const firstLoadingDate = loading[0]?.dateLocal ?? null;
  const transportYear = firstLoadingDate
    ? parseInt(firstLoadingDate.substring(0, 4), 10)
    : new Date().getFullYear();

  return {
    first_loading_date: loading[0]?.dateLocal ?? null,
    first_loading_time: loading[0]?.timeLocal ?? null,
    first_unloading_date: unloading[0]?.dateLocal ?? null,
    first_unloading_time: unloading[0]?.timeLocal ?? null,
    last_loading_date: loading.length > 0 ? loading[loading.length - 1]?.dateLocal ?? null : null,
    last_loading_time: loading.length > 0 ? loading[loading.length - 1]?.timeLocal ?? null : null,
    last_unloading_date: unloading.length > 0 ? unloading[unloading.length - 1]?.dateLocal ?? null : null,
    last_unloading_time: unloading.length > 0 ? unloading[unloading.length - 1]?.timeLocal ?? null : null,
    first_loading_country: firstLoadingCountry,
    first_unloading_country: firstUnloadingCountry,
    summary_route: summaryRoute,
    main_product_name: mainProductName,
    transport_year: transportYear,
  };
}

/** Buduje search_text z dostępnych danych zlecenia (do full-text wyszukiwania). */
function buildSearchText(
  orderNo: string,
  carrierName: string | null,
  stops: Array<{ locationNameSnapshot?: string | null; companyNameSnapshot?: string | null }>,
  items: Array<{ productNameSnapshot: string | null }>,
  notes: string | null
): string {
  const parts: string[] = [orderNo];
  if (carrierName) parts.push(carrierName);
  for (const s of stops) {
    if (s.companyNameSnapshot) parts.push(s.companyNameSnapshot);
    if (s.locationNameSnapshot) parts.push(s.locationNameSnapshot);
  }
  for (const i of items) {
    if (i.productNameSnapshot) parts.push(i.productNameSnapshot);
  }
  if (notes) parts.push(notes);
  return parts.join(" ");
}

/**
 * Automatyczne ustawienie required_documents_text i currency_code wg typu transportu.
 * Sekcja 5 db-plan: PL → PLN, EXP/EXP_K/IMP → EUR; dokumenty wg typu.
 */
function autoSetDocumentsAndCurrency(
  transportTypeCode: string,
  userCurrency: string
): { requiredDocumentsText: string; currencyCode: string } {
  let requiredDocumentsText = "";

  switch (transportTypeCode) {
    case "PL":
      requiredDocumentsText = "WZ, KPO, kwit wagowy";
      break;
    case "EXP":
    case "EXP_K":
    case "IMP":
      requiredDocumentsText = "WZE, Aneks VII, CMR";
      break;
  }
  return { requiredDocumentsText, currencyCode: userCurrency };
}

/**
 * Waliduje istnienie referencji FK w bazie (transportTypeCode, carrierCompanyId, itp.).
 * Zwraca obiekt z błędami walidacji lub null gdy OK.
 */
async function validateForeignKeys(
  supabase: SupabaseClient<Database>,
  params: {
    transportTypeCode: string;
    carrierCompanyId?: string | null;
    stops: Array<{ locationId: string | null }>;
    items: Array<{ productId: string | null }>;
  }
): Promise<Record<string, string> | null> {
  const errors: Record<string, string> = {};

  // transportTypeCode
  const { data: tt } = await supabase
    .from("transport_types")
    .select("code")
    .eq("code", params.transportTypeCode)
    .eq("is_active", true)
    .maybeSingle();
  if (!tt) errors.transportTypeCode = "Typ transportu nie istnieje lub jest nieaktywny.";

  // carrierCompanyId
  if (params.carrierCompanyId) {
    const { data: cc } = await supabase
      .from("companies")
      .select("id")
      .eq("id", params.carrierCompanyId)
      .eq("is_active", true)
      .maybeSingle();
    if (!cc) errors.carrierCompanyId = "Firma przewoźnika nie istnieje lub jest nieaktywna.";
  }

  // locationId w stops
  const locationIds = [...new Set(params.stops.map((s) => s.locationId).filter(Boolean))] as string[];
  if (locationIds.length > 0) {
    const { data: locs } = await supabase
      .from("locations")
      .select("id")
      .in("id", locationIds)
      .eq("is_active", true);
    const foundIds = new Set((locs ?? []).map((l) => l.id));
    for (const lid of locationIds) {
      if (!foundIds.has(lid)) {
        errors[`stops.locationId(${lid})`] = "Lokalizacja nie istnieje lub jest nieaktywna.";
      }
    }
  }

  // productId w items
  const productIds = [...new Set(params.items.map((i) => i.productId).filter(Boolean))] as string[];
  if (productIds.length > 0) {
    const { data: prods } = await supabase
      .from("products")
      .select("id")
      .in("id", productIds)
      .eq("is_active", true);
    const foundIds = new Set((prods ?? []).map((p) => p.id));
    for (const pid of productIds) {
      if (!foundIds.has(pid)) {
        errors[`items.productId(${pid})`] = "Produkt nie istnieje lub jest nieaktywny.";
      }
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * Generuje kolejny numer zlecenia w formacie ZT{year}/{seqNo 4 cyfry}.
 *
 * Używa atomowej funkcji RPC (generate_next_order_no) w PostgreSQL,
 * która stosuje pg_advisory_xact_lock do serializacji równoczesnych wywołań.
 * Eliminuje race condition, w którym dwa równoczesne POST mogłyby dostać ten sam numer.
 */
async function generateOrderNo(
  supabase: SupabaseClient<Database>
): Promise<string> {
  // Cast needed: generated Supabase types don't include custom RPC functions.
  // RPC zdefiniowane w supabase/migrations/20260207000000_consolidated_schema.sql (sekcja 7.2).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("generate_next_order_no");

  if (error) throw error;
  if (!data || typeof data !== "string") {
    throw new Error("Unexpected result from generate_next_order_no RPC");
  }

  return data;
}

const STATUS_ROBOCZE = "robocze";

/**
 * Kopiuje zlecenie: nowy numer, opcjonalnie stops i items, opcjonalnie status robocze.
 * Zwraca null gdy oryginał nie istnieje.
 *
 * @param supabase — klient Supabase
 * @param userId — id użytkownika (created_by_user_id nowego zlecenia)
 * @param orderId — UUID oryginalnego zlecenia
 * @param params — includeStops, includeItems, resetStatusToDraft
 */
export async function duplicateOrder(
  supabase: SupabaseClient<Database>,
  userId: string,
  orderId: string,
  params: DuplicateOrderParams
): Promise<DuplicateOrderResponseDto | null> {
  const detail = await getOrderDetail(supabase, orderId);
  if (!detail) return null;

  const orderNo = await generateOrderNo(supabase);
  const newStatus = params.resetStatusToDraft ? STATUS_ROBOCZE : detail.order.statusCode;

  // Walidacja FK — kopia może zawierać nieaktywne referencje
  const fkErrors = await validateForeignKeys(supabase, {
    transportTypeCode: detail.order.transportTypeCode,
    carrierCompanyId: detail.order.carrierCompanyId,
    stops: params.includeStops ? detail.stops.map((s) => ({ locationId: s.locationId })) : [],
    items: params.includeItems ? detail.items.map((i) => ({ productId: i.productId })) : [],
  });
  if (fkErrors) {
    const err = new Error("FK_VALIDATION");
    (err as Error & { details: Record<string, string> }).details = fkErrors;
    throw err;
  }

  const insertPayload: Record<string, unknown> = {
    order_no: orderNo,
    status_code: newStatus,
    transport_type_code: detail.order.transportTypeCode,
    currency_code: detail.order.currencyCode,
    vehicle_type_text: detail.order.vehicleTypeText ?? null,
    vehicle_capacity_volume_m3: detail.order.vehicleCapacityVolumeM3 ?? null,
    created_by_user_id: userId,
    carrier_company_id: detail.order.carrierCompanyId ?? null,
    carrier_name_snapshot: detail.order.carrierNameSnapshot ?? null,
    carrier_address_snapshot: detail.order.carrierAddressSnapshot ?? null,
    carrier_location_name_snapshot: detail.order.carrierLocationNameSnapshot ?? null,
    shipper_location_id: detail.order.shipperLocationId ?? null,
    shipper_name_snapshot: detail.order.shipperNameSnapshot ?? null,
    shipper_address_snapshot: detail.order.shipperAddressSnapshot ?? null,
    receiver_location_id: detail.order.receiverLocationId ?? null,
    receiver_name_snapshot: detail.order.receiverNameSnapshot ?? null,
    receiver_address_snapshot: detail.order.receiverAddressSnapshot ?? null,
    price_amount: detail.order.priceAmount ?? null,
    payment_term_days: detail.order.paymentTermDays ?? null,
    payment_method: detail.order.paymentMethod ?? null,
    total_load_tons: detail.order.totalLoadTons ?? null,
    total_load_volume_m3: detail.order.totalLoadVolumeM3 ?? null,
    special_requirements: detail.order.specialRequirements ?? null,
    required_documents_text: detail.order.requiredDocumentsText ?? null,
    general_notes: detail.order.generalNotes ?? null,
    sender_contact_name: detail.order.senderContactName ?? null,
    sender_contact_phone: detail.order.senderContactPhone ?? null,
    sender_contact_email: detail.order.senderContactEmail ?? null,
    sent_at: null,
    sent_by_user_id: null,
    locked_at: null,
    locked_by_user_id: null,
    // Denormalizowane pola dat = null → kopia trafia na dół listy (ASC, nulls last).
    // Daty pozostają w skopiowanych stopach. Pola przeliczą się przy pierwszym PUT.
    first_loading_date: null,
    first_loading_time: null,
    first_unloading_date: null,
    first_unloading_time: null,
    last_loading_date: null,
    last_loading_time: null,
    last_unloading_date: null,
    last_unloading_time: null,
    first_loading_country: detail.order.firstLoadingCountry ?? null,
    first_unloading_country: detail.order.firstUnloadingCountry ?? null,
    summary_route: detail.order.summaryRoute ?? null,
    main_product_name: detail.order.mainProductName ?? null,
    transport_year: detail.order.transportYear ?? null,
    search_text: buildSearchText(
      orderNo,
      detail.order.carrierNameSnapshot ?? null,
      params.includeStops ? detail.stops : [],
      params.includeItems ? detail.items : [],
      detail.order.generalNotes
    ),
  };

  type OrderInsert = Database["public"]["Tables"]["transport_orders"]["Insert"];
  const { data: newOrder, error: orderError } = await supabase
    .from("transport_orders")
    .insert(insertPayload as OrderInsert)
    .select("id, created_at")
    .single();

  if (orderError || !newOrder) throw orderError ?? new Error("Duplicate order insert failed");
  const newOrderId = newOrder.id;

  // INSERT stops + items z kompensującym cleanup (M-01)
  try {
    if (params.includeStops && detail.stops.length > 0) {
      const stopsInsert = detail.stops.map((s, i) => ({
        order_id: newOrderId,
        kind: s.kind,
        sequence_no: s.sequenceNo ?? i + 1,
        date_local: s.dateLocal ?? null,
        time_local: s.timeLocal ?? null,
        location_id: s.locationId ?? null,
        location_name_snapshot: s.locationNameSnapshot ?? null,
        company_name_snapshot: s.companyNameSnapshot ?? null,
        address_snapshot: s.addressSnapshot ?? null,
        notes: s.notes ?? null,
      }));
      const { error: stopsErr } = await supabase.from("order_stops").insert(stopsInsert);
      if (stopsErr) throw stopsErr;
    }

    if (params.includeItems && detail.items.length > 0) {
      const itemsInsert = detail.items.map((i) => ({
        order_id: newOrderId,
        product_id: i.productId ?? null,
        product_name_snapshot: i.productNameSnapshot ?? null,
        default_loading_method_snapshot: i.defaultLoadingMethodSnapshot ?? null,
        loading_method_code: i.loadingMethodCode ?? null,
        quantity_tons: i.quantityTons ?? null,
        notes: i.notes ?? null,
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(itemsInsert);
      if (itemsErr) throw itemsErr;
    }

    // Wpis do historii statusów — nowe zlecenie z duplikacji.
    // old_status_code = newStatus (brak poprzedniego stanu), gdyż kolumna NOT NULL z FK.
    const { error: historyErr } = await supabase.from("order_status_history").insert({
      order_id: newOrderId,
      old_status_code: newStatus,
      new_status_code: newStatus,
      changed_by_user_id: userId,
    });
    if (historyErr) throw historyErr;
  } catch (err) {
    // Kompensujący cleanup — usuń osierocony duplikat zlecenia
    await supabase.from("transport_orders").delete().eq("id", newOrderId);
    throw err;
  }

  // Nazwa statusu — z oryginału lub z bazy gdy reset do robocze (api-plan §2.9)
  let statusName: string;
  if (!params.resetStatusToDraft) {
    statusName = detail.order.statusName;
  } else {
    const { data: statusRow } = await supabase
      .from("order_statuses")
      .select("name")
      .eq("code", STATUS_ROBOCZE)
      .single();
    statusName = statusRow?.name ?? STATUS_ROBOCZE;
  }

  return {
    id: newOrderId,
    orderNo,
    statusCode: newStatus,
    statusName,
    createdAt: newOrder.created_at,
  };
}

/**
 * Tworzy nowe zlecenie (status robocze).
 * Generuje order_no, wstawia nagłówek, punkty trasy i pozycje.
 * Pobiera snapshoty z lokalizacji/firm/produktów i oblicza pola denormalizowane.
 * Waliduje FK (transportTypeCode, carrierCompanyId, locationId, productId).
 *
 * @param supabase — klient Supabase
 * @param userId — id użytkownika (created_by_user_id)
 * @param params — dane z createOrderSchema
 * @returns CreateOrderResponseDto; rzuca FK_VALIDATION z details przy błędach FK
 */
export async function createOrder(
  supabase: SupabaseClient<Database>,
  userId: string,
  params: CreateOrderParams
): Promise<CreateOrderResponseDto> {
  // 1a. Limity punktów trasy (max 8 LOADING, max 3 UNLOADING)
  const loadingCount = params.stops.filter((s) => s.kind === "LOADING").length;
  const unloadingCount = params.stops.filter((s) => s.kind === "UNLOADING").length;
  if (loadingCount > MAX_LOADING_STOPS) {
    throw new Error("STOPS_LIMIT");
  }
  if (unloadingCount > MAX_UNLOADING_STOPS) {
    throw new Error("STOPS_LIMIT");
  }

  // 1a2. Kolejność: pierwszy stop = LOADING, ostatni = UNLOADING
  if (params.stops.length >= 2) {
    if (params.stops[0].kind !== "LOADING") {
      throw new Error("STOPS_ORDER");
    }
    if (params.stops[params.stops.length - 1].kind !== "UNLOADING") {
      throw new Error("STOPS_ORDER");
    }
  }

  // 1b. Walidacja FK
  const fkErrors = await validateForeignKeys(supabase, {
    transportTypeCode: params.transportTypeCode,
    carrierCompanyId: params.carrierCompanyId,
    stops: params.stops,
    items: params.items,
  });
  if (fkErrors) {
    const err = new Error("FK_VALIDATION");
    (err as Error & { details: Record<string, string> }).details = fkErrors;
    throw err;
  }

  // 2. Generuj numer zlecenia
  const orderNo = await generateOrderNo(supabase);

  // 3. Automatyczne ustawienia wg typu transportu
  const auto = autoSetDocumentsAndCurrency(
    params.transportTypeCode,
    params.currencyCode
  );
  const requiredDocumentsText = params.requiredDocumentsText ?? auto.requiredDocumentsText;
  const currencyCode = params.currencyCode || auto.currencyCode;

  // 4. Snapshoty przewoźnika
  let carrierSnapshots = {
    carrier_name_snapshot: null as string | null,
    carrier_address_snapshot: null as string | null,
    carrier_location_name_snapshot: null as string | null,
  };
  if (params.carrierCompanyId) {
    carrierSnapshots = await buildSnapshotsForCarrier(supabase, params.carrierCompanyId);
  }

  // 5. Snapshoty shipper / receiver
  let shipperSnapshots = { nameSnapshot: null as string | null, addressSnapshot: null as string | null };
  if (params.shipperLocationId) {
    shipperSnapshots = await buildSnapshotsForShipperReceiver(supabase, params.shipperLocationId);
  }
  let receiverSnapshots = { nameSnapshot: null as string | null, addressSnapshot: null as string | null };
  if (params.receiverLocationId) {
    receiverSnapshots = await buildSnapshotsForShipperReceiver(supabase, params.receiverLocationId);
  }

  // 6. Batch snapshoty dla stops (1 query zamiast N)
  const stopLocationIds = params.stops.map((s) => s.locationId).filter(Boolean) as string[];
  const itemProductIds = params.items.map((i) => i.productId).filter(Boolean) as string[];
  const [locationSnapMap, productSnapMap] = await Promise.all([
    batchBuildSnapshotsForLocations(supabase, stopLocationIds),
    batchBuildSnapshotsForItems(supabase, itemProductIds),
  ]);

  const stopsWithSnapshots = params.stops.map((s, i) => {
    const snap = s.locationId ? locationSnapMap.get(s.locationId) ?? null : null;
    return {
      kind: s.kind,
      sequenceNo: i + 1,
      dateLocal: s.dateLocal ?? null,
      timeLocal: s.timeLocal ?? null,
      locationId: s.locationId ?? null,
      notes: s.notes ?? null,
      locationNameSnapshot: snap?.locationNameSnapshot ?? null,
      companyNameSnapshot: snap?.companyNameSnapshot ?? null,
      addressSnapshot: snap?.addressSnapshot ?? null,
      country: snap?.country ?? null,
    };
  });

  // 7. Snapshoty items z batch mapy
  const itemsWithSnapshots = params.items.map((item) => {
    const snap = item.productId ? productSnapMap.get(item.productId) ?? null : null;
    return {
      productId: item.productId ?? null,
      productNameSnapshot: item.productNameSnapshot ?? snap?.productNameSnapshot ?? null,
      defaultLoadingMethodSnapshot: snap?.defaultLoadingMethodSnapshot ?? null,
      loadingMethodCode: item.loadingMethodCode ?? null,
      quantityTons: item.quantityTons ?? null,
      notes: item.notes ?? null,
    };
  });

  // 8. Denormalizacja (daty, kraje, summary_route, main_product_name, transport_year)
  const denorm = computeDenormalizedFields(stopsWithSnapshots, itemsWithSnapshots);

  // 9. search_text
  const searchText = buildSearchText(
    orderNo,
    carrierSnapshots.carrier_name_snapshot,
    stopsWithSnapshots,
    itemsWithSnapshots,
    params.generalNotes
  );

  // 10. INSERT transport_orders
  type OrderInsert = Database["public"]["Tables"]["transport_orders"]["Insert"];
  const insertPayload: Record<string, unknown> = {
    order_no: orderNo,
    status_code: STATUS_ROBOCZE,
    transport_type_code: params.transportTypeCode,
    currency_code: currencyCode,
    vehicle_type_text: params.vehicleTypeText ?? null,
    vehicle_capacity_volume_m3: params.vehicleCapacityVolumeM3 ?? null,
    created_by_user_id: userId,
    carrier_company_id: params.carrierCompanyId ?? null,
    carrier_name_snapshot: carrierSnapshots.carrier_name_snapshot,
    carrier_address_snapshot: carrierSnapshots.carrier_address_snapshot,
    carrier_location_name_snapshot: carrierSnapshots.carrier_location_name_snapshot,
    shipper_location_id: params.shipperLocationId ?? null,
    shipper_name_snapshot: shipperSnapshots.nameSnapshot,
    shipper_address_snapshot: shipperSnapshots.addressSnapshot,
    receiver_location_id: params.receiverLocationId ?? null,
    receiver_name_snapshot: receiverSnapshots.nameSnapshot,
    receiver_address_snapshot: receiverSnapshots.addressSnapshot,
    price_amount: params.priceAmount ?? null,
    payment_term_days: params.paymentTermDays ?? null,
    payment_method: params.paymentMethod ?? null,
    total_load_tons: params.totalLoadTons ?? null,
    total_load_volume_m3: params.totalLoadVolumeM3 ?? null,
    special_requirements: params.specialRequirements ?? null,
    required_documents_text: requiredDocumentsText,
    general_notes: params.generalNotes ?? null,
    sender_contact_name: params.senderContactName ?? null,
    sender_contact_phone: params.senderContactPhone ?? null,
    sender_contact_email: params.senderContactEmail ?? null,
    first_loading_date: denorm.first_loading_date,
    first_loading_time: denorm.first_loading_time,
    first_unloading_date: denorm.first_unloading_date,
    first_unloading_time: denorm.first_unloading_time,
    last_loading_date: denorm.last_loading_date,
    last_loading_time: denorm.last_loading_time,
    last_unloading_date: denorm.last_unloading_date,
    last_unloading_time: denorm.last_unloading_time,
    first_loading_country: denorm.first_loading_country,
    first_unloading_country: denorm.first_unloading_country,
    summary_route: denorm.summary_route,
    main_product_name: denorm.main_product_name,
    transport_year: denorm.transport_year,
    search_text: searchText,
  };

  const { data: order, error: orderError } = await supabase
    .from("transport_orders")
    .insert(insertPayload as OrderInsert)
    .select("id, created_at")
    .single();

  if (orderError || !order) throw orderError ?? new Error("Insert order failed");

  const orderId = order.id;

  // 11-12. INSERT order_stops + order_items z kompensującym cleanup (M-01)
  try {
    if (stopsWithSnapshots.length > 0) {
      const stopsInsert = stopsWithSnapshots.map((s) => ({
        order_id: orderId,
        kind: s.kind,
        sequence_no: s.sequenceNo,
        date_local: s.dateLocal,
        time_local: s.timeLocal,
        location_id: s.locationId,
        location_name_snapshot: s.locationNameSnapshot,
        company_name_snapshot: s.companyNameSnapshot,
        address_snapshot: s.addressSnapshot,
        notes: s.notes,
      }));
      const { error: stopsError } = await supabase.from("order_stops").insert(stopsInsert);
      if (stopsError) throw stopsError;
    }

    if (itemsWithSnapshots.length > 0) {
      const itemsInsert = itemsWithSnapshots.map((i) => ({
        order_id: orderId,
        product_id: i.productId,
        product_name_snapshot: i.productNameSnapshot,
        default_loading_method_snapshot: i.defaultLoadingMethodSnapshot,
        loading_method_code: i.loadingMethodCode,
        quantity_tons: i.quantityTons,
        notes: i.notes,
      }));
      const { error: itemsError } = await supabase.from("order_items").insert(itemsInsert);
      if (itemsError) throw itemsError;
    }
  } catch (err) {
    // Kompensujący cleanup — usuń osierocony nagłówek zlecenia
    await supabase.from("transport_orders").delete().eq("id", orderId);
    throw err;
  }

  // Audit trail: wpis "Utworzono zlecenie"
  const { error: createdLogErr } = await supabase.from("order_change_log").insert({
    order_id: orderId,
    field_name: "order_created",
    old_value: null,
    new_value: orderNo,
    changed_by_user_id: userId,
  });
  if (createdLogErr) throw createdLogErr;

  // Pobierz nazwę statusu dla odpowiedzi DTO (api-plan §2.4)
  const { data: statusRow } = await supabase
    .from("order_statuses")
    .select("name")
    .eq("code", STATUS_ROBOCZE)
    .single();

  return {
    id: orderId,
    orderNo,
    statusCode: STATUS_ROBOCZE,
    statusName: statusRow?.name ?? STATUS_ROBOCZE,
    createdAt: order.created_at,
  };
}

/** Statusy, z których nie wolno edytować zlecenia (PUT). */
const READONLY_STATUSES = new Set(["zrealizowane", "anulowane"]);

/** Statusy powodujące automatyczne przejście na „korekta” przy edycji pól biznesowych. */
const AUTO_KOREKTA_FROM = new Set(["wysłane", "korekta wysłane"]);

const STATUS_KOREKTA = "korekta";

const MAX_LOADING_STOPS = 8;
const MAX_UNLOADING_STOPS = 3;



/**
 * Pełna aktualizacja zlecenia (nagłówek + punkty trasy + pozycje).
 * Sprawdza blokadę (409), status (400 dla zrealizowane/anulowane), limity stops (max 8 LOADING, 3 UNLOADING).
 * Automatyczne przejście na „korekta” gdy status to wysłane/korekta wysłane.
 *
 * @param supabase — klient Supabase
 * @param userId — id użytkownika (updated_by_user_id)
 * @param orderId — UUID zlecenia
 * @param params — dane z updateOrderSchema
 * @returns UpdateOrderResponseDto lub null gdy zlecenie nie istnieje; rzuca LOCKED, FORBIDDEN_EDIT, STOPS_LIMIT
 */
export async function updateOrder(
  supabase: SupabaseClient<Database>,
  userId: string,
  orderId: string,
  params: UpdateOrderParams
): Promise<UpdateOrderResponseDto | null> {
  // Rozszerzony SELECT o pola biznesowe do logowania zmian (M-02).
  // Kolumny payment_term_days, payment_method, total_load_volume_m3, special_requirements
  // istnieją w DB (consolidated_schema.sql) ale brakuje ich w wygenerowanych typach — stąd cast.
  const { data: order, error: fetchError } = await (supabase
    .from("transport_orders")
    .select(`id, order_no, status_code, locked_by_user_id,
      transport_type_code, carrier_company_id, vehicle_type_text, vehicle_capacity_volume_m3,
      price_amount, currency_code, payment_term_days, payment_method,
      general_notes, complaint_reason, required_documents_text,
      special_requirements, total_load_tons, total_load_volume_m3,
      shipper_location_id, receiver_location_id,
      sender_contact_name, sender_contact_phone, sender_contact_email`)
    .eq("id", orderId)
    .maybeSingle() as unknown as Promise<{
      data: {
        id: string; order_no: string; status_code: string; locked_by_user_id: string | null;
        transport_type_code: string; carrier_company_id: string | null;
        vehicle_type_text: string | null; vehicle_capacity_volume_m3: number | null;
        price_amount: number | null; currency_code: string;
        payment_term_days: number | null; payment_method: string | null;
        general_notes: string | null; complaint_reason: string | null;
        required_documents_text: string | null; special_requirements: string | null;
        total_load_tons: number | null; total_load_volume_m3: number | null;
        shipper_location_id: string | null; receiver_location_id: string | null;
        sender_contact_name: string | null; sender_contact_phone: string | null;
        sender_contact_email: string | null;
      } | null;
      error: import("@supabase/supabase-js").AuthError | null;
    }>);

  if (fetchError) throw fetchError;
  if (!order) return null;

  if (order.locked_by_user_id != null && order.locked_by_user_id !== userId) {
    throw new Error("LOCKED");
  }

  if (READONLY_STATUSES.has(order.status_code)) {
    throw new Error("FORBIDDEN_EDIT");
  }

  // FK validation
  const activeStops = params.stops.filter((s) => !s._deleted).sort((a, b) => a.sequenceNo - b.sequenceNo);
  const activeItems = params.items.filter((i) => !i._deleted);

  // Audit trail: snapshot starych items do porównania
  const { data: oldItemsRaw } = await supabase
    .from("order_items")
    .select("id, product_name_snapshot, loading_method_code, quantity_tons, notes")
    .eq("order_id", orderId);
  const oldItemsMap = new Map(
    (oldItemsRaw ?? []).map((r) => [r.id, r])
  );

  // Audit trail: snapshot starych stops do porównania
  const { data: oldStopsRaw } = await supabase
    .from("order_stops")
    .select("id, kind, sequence_no, company_name_snapshot")
    .eq("order_id", orderId)
    .order("sequence_no", { ascending: true });
  const oldStopsMap = new Map(
    (oldStopsRaw ?? []).map((r) => [r.id, r])
  );

  const fkErrors = await validateForeignKeys(supabase, {
    transportTypeCode: params.transportTypeCode,
    carrierCompanyId: params.carrierCompanyId,
    stops: activeStops,
    items: activeItems,
  });
  if (fkErrors) {
    const err = new Error("FK_VALIDATION");
    (err as Error & { details: Record<string, string> }).details = fkErrors;
    throw err;
  }

  const loadingCount = activeStops.filter((s) => s.kind === "LOADING").length;
  const unloadingCount = activeStops.filter((s) => s.kind === "UNLOADING").length;
  if (loadingCount > MAX_LOADING_STOPS) {
    throw new Error("STOPS_LIMIT");
  }
  if (unloadingCount > MAX_UNLOADING_STOPS) {
    throw new Error("STOPS_LIMIT");
  }

  // Kolejność: pierwszy stop = LOADING, ostatni = UNLOADING
  if (activeStops.length >= 2) {
    const sorted = [...activeStops].sort((a, b) => a.sequenceNo - b.sequenceNo);
    if (sorted[0].kind !== "LOADING") {
      throw new Error("STOPS_ORDER");
    }
    if (sorted[sorted.length - 1].kind !== "UNLOADING") {
      throw new Error("STOPS_ORDER");
    }
  }

  // Batch snapshoty dla stops (1 query zamiast N)
  const stopLocationIds = activeStops.map((s) => s.locationId).filter(Boolean) as string[];
  const locationSnapMap = await batchBuildSnapshotsForLocations(supabase, stopLocationIds);

  const stopsWithSnapshots = activeStops.map((s) => {
    const snap = s.locationId ? locationSnapMap.get(s.locationId) ?? null : null;
    return {
      ...s,
      locationNameSnapshot: snap?.locationNameSnapshot ?? null,
      companyNameSnapshot: snap?.companyNameSnapshot ?? null,
      addressSnapshot: snap?.addressSnapshot ?? null,
      country: snap?.country ?? null,
    };
  });

  // Snapshoty przewoźnika
  let carrierSnapshots = {
    carrier_name_snapshot: null as string | null,
    carrier_address_snapshot: null as string | null,
    carrier_location_name_snapshot: null as string | null,
  };
  if (params.carrierCompanyId) {
    carrierSnapshots = await buildSnapshotsForCarrier(supabase, params.carrierCompanyId);
  }

  // Snapshoty shipper / receiver
  let shipperSnapshots = { nameSnapshot: null as string | null, addressSnapshot: null as string | null };
  if (params.shipperLocationId) {
    shipperSnapshots = await buildSnapshotsForShipperReceiver(supabase, params.shipperLocationId);
  }
  let receiverSnapshots = { nameSnapshot: null as string | null, addressSnapshot: null as string | null };
  if (params.receiverLocationId) {
    receiverSnapshots = await buildSnapshotsForShipperReceiver(supabase, params.receiverLocationId);
  }

  // Batch snapshoty dla items (1 query zamiast N)
  const itemProductIds = activeItems.map((i) => i.productId).filter(Boolean) as string[];
  const productSnapMap = await batchBuildSnapshotsForItems(supabase, itemProductIds);

  const itemsWithSnapshots = activeItems.map((item) => {
    const snap = item.productId ? productSnapMap.get(item.productId) ?? null : null;
    return {
      ...item,
      productNameSnapshot: item.productNameSnapshot ?? snap?.productNameSnapshot ?? null,
      defaultLoadingMethodSnapshot: snap?.defaultLoadingMethodSnapshot ?? null,
    };
  });

  // Denormalizacja (daty, kraje, summary_route, main_product_name, transport_year)
  const denorm = computeDenormalizedFields(
    stopsWithSnapshots.map((s) => ({
      kind: s.kind,
      dateLocal: s.dateLocal ?? null,
      timeLocal: s.timeLocal ?? null,
      locationNameSnapshot: s.locationNameSnapshot,
      country: s.country,
    })),
    itemsWithSnapshots.map((i) => ({ productNameSnapshot: i.productNameSnapshot }))
  );

  let newStatusCode = order.status_code;
  if (AUTO_KOREKTA_FROM.has(order.status_code)) {
    newStatusCode = STATUS_KOREKTA;
  }

  // search_text
  const searchText = buildSearchText(
    order.order_no,
    carrierSnapshots.carrier_name_snapshot,
    stopsWithSnapshots,
    itemsWithSnapshots.map((i) => ({ productNameSnapshot: i.productNameSnapshot })),
    params.generalNotes
  );

  const updatePayload: Record<string, unknown> = {
    transport_type_code: params.transportTypeCode,
    currency_code: params.currencyCode,
    vehicle_type_text: params.vehicleTypeText ?? null,
    vehicle_capacity_volume_m3: params.vehicleCapacityVolumeM3 ?? null,
    carrier_company_id: params.carrierCompanyId ?? null,
    carrier_name_snapshot: carrierSnapshots.carrier_name_snapshot,
    carrier_address_snapshot: carrierSnapshots.carrier_address_snapshot,
    carrier_location_name_snapshot: carrierSnapshots.carrier_location_name_snapshot,
    shipper_location_id: params.shipperLocationId ?? null,
    shipper_name_snapshot: shipperSnapshots.nameSnapshot,
    shipper_address_snapshot: shipperSnapshots.addressSnapshot,
    receiver_location_id: params.receiverLocationId ?? null,
    receiver_name_snapshot: receiverSnapshots.nameSnapshot,
    receiver_address_snapshot: receiverSnapshots.addressSnapshot,
    price_amount: params.priceAmount ?? null,
    payment_term_days: params.paymentTermDays ?? null,
    payment_method: params.paymentMethod ?? null,
    total_load_tons: params.totalLoadTons ?? null,
    total_load_volume_m3: params.totalLoadVolumeM3 ?? null,
    special_requirements: params.specialRequirements ?? null,
    required_documents_text: params.requiredDocumentsText ?? null,
    general_notes: params.generalNotes ?? null,
    // Spread warunkowy — nie nadpisuj complaint_reason gdy frontend nie wysyła pola
    ...(params.complaintReason !== undefined ? { complaint_reason: params.complaintReason } : {}),
    sender_contact_name: params.senderContactName ?? null,
    sender_contact_phone: params.senderContactPhone ?? null,
    sender_contact_email: params.senderContactEmail ?? null,
    first_loading_date: denorm.first_loading_date,
    first_loading_time: denorm.first_loading_time,
    first_unloading_date: denorm.first_unloading_date,
    first_unloading_time: denorm.first_unloading_time,
    last_loading_date: denorm.last_loading_date,
    last_loading_time: denorm.last_loading_time,
    last_unloading_date: denorm.last_unloading_date,
    last_unloading_time: denorm.last_unloading_time,
    first_loading_country: denorm.first_loading_country,
    first_unloading_country: denorm.first_unloading_country,
    main_product_name: denorm.main_product_name,
    summary_route: denorm.summary_route,
    transport_year: denorm.transport_year,
    search_text: searchText,
    status_code: newStatusCode,
    updated_by_user_id: userId,
  };

  // Atomic UPDATE with lock ownership verification in WHERE clause.
  // Prevents TOCTOU: even if lock was stolen between the SELECT above and this UPDATE,
  // the UPDATE will match 0 rows and we detect the conflict.
  // Note: PostgREST v14 bug — .or() + .select() on UPDATE generates invalid SQL,
  // so we use { count: "exact" } without .select() to detect row count instead.
  type OrderUpdate = Database["public"]["Tables"]["transport_orders"]["Update"];
  const { count: updatedCount, error: updateError } = await supabase
    .from("transport_orders")
    .update(updatePayload as OrderUpdate, { count: "exact" })
    .eq("id", orderId)
    .or(`locked_by_user_id.is.null,locked_by_user_id.eq.${userId}`);

  if (updateError) throw updateError;
  if (updatedCount === 0) {
    // 0 rows matched — lock was taken by another user between SELECT and UPDATE
    throw new Error("LOCKED");
  }

  // Build snapshot lookup for stops by sequenceNo (stopsWithSnapshots contains only active stops)
  const stopSnapshotMap = new Map(
    stopsWithSnapshots.map((s) => [s.sequenceNo, s])
  );

  // Phase 1: Delete _deleted stops
  for (const s of params.stops) {
    if (s._deleted && s.id) {
      const { error: delErr } = await supabase.from("order_stops").delete().eq("id", s.id).eq("order_id", orderId);
      if (delErr) throw delErr;
    }
  }

  // Phase 2: Temporarily offset existing stops' sequence_no to avoid UNIQUE constraint violations
  const existingStops = params.stops.filter((s) => !s._deleted && s.id);
  if (existingStops.length > 0) {
    for (let i = 0; i < existingStops.length; i++) {
      const { error: tmpErr } = await supabase
        .from("order_stops")
        .update({ sequence_no: 10000 + i })
        .eq("id", existingStops[i].id!)
        .eq("order_id", orderId);
      if (tmpErr) throw tmpErr;
    }
  }

  // Phase 3: Update existing stops to final values + insert new stops
  for (const s of params.stops) {
    if (s._deleted) continue;

    const snap = stopSnapshotMap.get(s.sequenceNo);
    if (s.id == null) {
      const { error: insErr } = await supabase.from("order_stops").insert({
        order_id: orderId,
        kind: s.kind,
        sequence_no: s.sequenceNo,
        date_local: s.dateLocal ?? null,
        time_local: s.timeLocal ?? null,
        location_id: s.locationId ?? null,
        location_name_snapshot: snap?.locationNameSnapshot ?? null,
        company_name_snapshot: snap?.companyNameSnapshot ?? null,
        address_snapshot: snap?.addressSnapshot ?? null,
        notes: s.notes ?? null,
      });
      if (insErr) throw insErr;
    } else {
      const { error: updErr } = await supabase
        .from("order_stops")
        .update({
          kind: s.kind,
          sequence_no: s.sequenceNo,
          date_local: s.dateLocal ?? null,
          time_local: s.timeLocal ?? null,
          location_id: s.locationId ?? null,
          location_name_snapshot: snap?.locationNameSnapshot ?? null,
          company_name_snapshot: snap?.companyNameSnapshot ?? null,
          address_snapshot: snap?.addressSnapshot ?? null,
          notes: s.notes ?? null,
        })
        .eq("id", s.id)
        .eq("order_id", orderId);
      if (updErr) throw updErr;
    }
  }

  // Audit trail: logowanie dodawania/usuwania przystanków
  const stopChangeLogRows: Array<{
    order_id: string;
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    changed_by_user_id: string;
  }> = [];

  for (const s of params.stops) {
    if (s._deleted && s.id) {
      // Usunięty przystanek
      const oldStop = oldStopsMap.get(s.id);
      const kindPrefix = oldStop?.kind === "LOADING" ? "L" : "U";
      const label = `${kindPrefix}${oldStop?.sequence_no ?? "?"}: ${oldStop?.company_name_snapshot ?? "?"}`;
      stopChangeLogRows.push({
        order_id: orderId,
        field_name: "stop_removed",
        old_value: label,
        new_value: null,
        changed_by_user_id: userId,
      });
    } else if (s.id == null && !s._deleted) {
      // Nowy przystanek
      const snap = stopSnapshotMap.get(s.sequenceNo);
      const kindPrefix = s.kind === "LOADING" ? "L" : "U";
      const seqInKind = activeStops
        .filter((as) => as.kind === s.kind)
        .findIndex((as) => as.sequenceNo === s.sequenceNo) + 1;
      const label = `${kindPrefix}${seqInKind}: ${snap?.companyNameSnapshot ?? "?"}`;
      stopChangeLogRows.push({
        order_id: orderId,
        field_name: "stop_added",
        old_value: null,
        new_value: label,
        changed_by_user_id: userId,
      });
    }
  }

  if (stopChangeLogRows.length > 0) {
    const { error: stopLogErr } = await supabase.from("order_change_log").insert(stopChangeLogRows);
    if (stopLogErr) throw stopLogErr;
  }

  // Build snapshot lookup for items by index
  const itemSnapshotByIdx = new Map(
    itemsWithSnapshots.map((item, idx) => [idx, item])
  );
  let activeItemIdx = 0;

  for (const i of params.items) {
    // Pomijaj usunięte pozycje bez id (nigdy nie zapisane w bazie)
    if (i._deleted && !i.id) continue;

    if (i._deleted && i.id) {
      const { error: delErr } = await supabase.from("order_items").delete().eq("id", i.id).eq("order_id", orderId);
      if (delErr) throw delErr;
    } else if (i.id == null) {
      // Nowa pozycja (INSERT)
      const snap = itemSnapshotByIdx.get(activeItemIdx);
      activeItemIdx++;
      const { error: insErr } = await supabase.from("order_items").insert({
        order_id: orderId,
        product_id: i.productId ?? null,
        product_name_snapshot: snap?.productNameSnapshot ?? i.productNameSnapshot ?? null,
        default_loading_method_snapshot: snap?.defaultLoadingMethodSnapshot ?? null,
        loading_method_code: i.loadingMethodCode ?? null,
        quantity_tons: i.quantityTons ?? null,
        notes: i.notes ?? null,
      });
      if (insErr) throw insErr;
    } else if (!i._deleted) {
      // Istniejąca pozycja (UPDATE)
      const snap = itemSnapshotByIdx.get(activeItemIdx);
      activeItemIdx++;
      const { error: updErr } = await supabase
        .from("order_items")
        .update({
          product_id: i.productId ?? null,
          product_name_snapshot: snap?.productNameSnapshot ?? i.productNameSnapshot ?? null,
          default_loading_method_snapshot: snap?.defaultLoadingMethodSnapshot ?? null,
          loading_method_code: i.loadingMethodCode ?? null,
          quantity_tons: i.quantityTons ?? null,
          notes: i.notes ?? null,
        })
        .eq("id", i.id)
        .eq("order_id", orderId);
      if (updErr) throw updErr;
    }
  }

  // Audit trail: logowanie zmian pozycji towarowych (items)
  const itemChangeLogRows: Array<{
    order_id: string;
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    changed_by_user_id: string;
  }> = [];

  // Numeracja aktywnych items (1-based)
  let auditItemNum = 0;
  for (const item of params.items) {
    if (item._deleted && !item.id) continue;

    if (item._deleted && item.id) {
      // Usunięta pozycja
      const oldItem = oldItemsMap.get(item.id);
      itemChangeLogRows.push({
        order_id: orderId,
        field_name: "item_removed",
        old_value: oldItem?.product_name_snapshot ?? null,
        new_value: null,
        changed_by_user_id: userId,
      });
    } else if (item.id == null) {
      // Nowa pozycja
      auditItemNum++;
      const snap = itemsWithSnapshots.find(
        (_s, idx) => idx === auditItemNum - 1
      );
      itemChangeLogRows.push({
        order_id: orderId,
        field_name: "item_added",
        old_value: null,
        new_value: snap?.productNameSnapshot ?? item.productNameSnapshot ?? null,
        changed_by_user_id: userId,
      });
    } else {
      // Istniejąca pozycja — porównanie pól
      auditItemNum++;
      const oldItem = oldItemsMap.get(item.id);
      if (oldItem) {
        const snap = itemsWithSnapshots.find(
          (_s, idx) => idx === auditItemNum - 1
        );
        const productName = snap?.productNameSnapshot ?? item.productNameSnapshot ?? null;

        // product_name
        if ((oldItem.product_name_snapshot ?? null) !== (productName)) {
          itemChangeLogRows.push({
            order_id: orderId,
            field_name: `item[${auditItemNum}].product_name`,
            old_value: oldItem.product_name_snapshot ?? null,
            new_value: productName,
            changed_by_user_id: userId,
          });
        }
        // loading_method_code
        const oldMethod = oldItem.loading_method_code ?? null;
        const newMethod = item.loadingMethodCode ?? null;
        if (oldMethod !== newMethod) {
          itemChangeLogRows.push({
            order_id: orderId,
            field_name: `item[${auditItemNum}].loading_method_code`,
            old_value: oldMethod,
            new_value: newMethod,
            changed_by_user_id: userId,
          });
        }
        // quantity_tons
        const oldQty = oldItem.quantity_tons != null ? String(oldItem.quantity_tons) : null;
        const newQty = item.quantityTons != null ? String(item.quantityTons) : null;
        if (oldQty !== newQty) {
          itemChangeLogRows.push({
            order_id: orderId,
            field_name: `item[${auditItemNum}].quantity_tons`,
            old_value: oldQty,
            new_value: newQty,
            changed_by_user_id: userId,
          });
        }
        // notes
        const oldNotes = oldItem.notes ?? null;
        const newNotes = item.notes ?? null;
        if (oldNotes !== newNotes) {
          itemChangeLogRows.push({
            order_id: orderId,
            field_name: `item[${auditItemNum}].notes`,
            old_value: oldNotes,
            new_value: newNotes,
            changed_by_user_id: userId,
          });
        }
      }
    }
  }

  if (itemChangeLogRows.length > 0) {
    const { error: itemLogErr } = await supabase.from("order_change_log").insert(itemChangeLogRows);
    if (itemLogErr) throw itemLogErr;
  }

  if (newStatusCode !== order.status_code) {
    const { error: historyErr } = await supabase.from("order_status_history").insert({
      order_id: orderId,
      old_status_code: order.status_code,
      new_status_code: newStatusCode,
      changed_by_user_id: userId,
    });
    if (historyErr) throw historyErr;

    const { error: logErr } = await supabase.from("order_change_log").insert({
      order_id: orderId,
      field_name: "status_code",
      old_value: order.status_code,
      new_value: newStatusCode,
      changed_by_user_id: userId,
    });
    if (logErr) throw logErr;
  }

  // M-02: Logowanie zmian pól biznesowych (PRD §3.1.8)
  const businessFieldMap: Array<{ key: keyof UpdateOrderParams; dbField: string }> = [
    { key: "transportTypeCode", dbField: "transport_type_code" },
    { key: "carrierCompanyId", dbField: "carrier_company_id" },
    { key: "vehicleTypeText", dbField: "vehicle_type_text" },
    { key: "vehicleCapacityVolumeM3", dbField: "vehicle_capacity_volume_m3" },
    { key: "priceAmount", dbField: "price_amount" },
    { key: "currencyCode", dbField: "currency_code" },
    { key: "paymentTermDays", dbField: "payment_term_days" },
    { key: "paymentMethod", dbField: "payment_method" },
    { key: "generalNotes", dbField: "general_notes" },
    { key: "complaintReason", dbField: "complaint_reason" },
    { key: "requiredDocumentsText", dbField: "required_documents_text" },
    { key: "shipperLocationId", dbField: "shipper_location_id" },
    { key: "receiverLocationId", dbField: "receiver_location_id" },
    { key: "senderContactName", dbField: "sender_contact_name" },
    { key: "senderContactPhone", dbField: "sender_contact_phone" },
    { key: "senderContactEmail", dbField: "sender_contact_email" },
    { key: "totalLoadTons", dbField: "total_load_tons" },
    { key: "totalLoadVolumeM3", dbField: "total_load_volume_m3" },
    { key: "specialRequirements", dbField: "special_requirements" },
  ];

  const changeLogRows: Array<{
    order_id: string;
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    changed_by_user_id: string;
  }> = [];

  // Audit trail: resolwer nazw dla pól FK (zamiast UUID)
  const FK_FIELDS = new Set(["carrier_company_id", "shipper_location_id", "receiver_location_id"]);

  async function resolveFkName(
    fieldKey: string,
    value: string | null
  ): Promise<string | null> {
    if (!value) return null;
    if (fieldKey === "carrier_company_id") {
      const { data } = await supabase
        .from("companies")
        .select("name")
        .eq("id", value)
        .maybeSingle();
      return data?.name ?? value;
    }
    if (fieldKey === "shipper_location_id" || fieldKey === "receiver_location_id") {
      const { data } = await supabase
        .from("locations")
        .select("name, companies(name)")
        .eq("id", value)
        .maybeSingle();
      const companyName = (data?.companies as { name: string } | null)?.name;
      return companyName ? `${companyName} — ${data?.name}` : data?.name ?? value;
    }
    return null;
  }

  for (const { key, dbField } of businessFieldMap) {
    const newVal = params[key];
    if (newVal !== undefined) {
      const oldVal = (order as Record<string, unknown>)[dbField];
      const oldStr = oldVal != null ? String(oldVal) : null;
      const newStr = newVal != null ? String(newVal) : null;
      if (oldStr !== newStr) {
        let resolvedOld = oldStr;
        let resolvedNew = newStr;
        if (FK_FIELDS.has(dbField)) {
          resolvedOld = await resolveFkName(dbField, oldStr) ?? oldStr;
          // Dla nowych wartości FK: użyj snapshotu (już pobranego)
          if (dbField === "carrier_company_id") {
            resolvedNew = carrierSnapshots.carrier_name_snapshot ?? newStr;
          } else if (dbField === "shipper_location_id") {
            resolvedNew = shipperSnapshots.nameSnapshot
              ? `${shipperSnapshots.nameSnapshot}`
              : newStr;
          } else if (dbField === "receiver_location_id") {
            resolvedNew = receiverSnapshots.nameSnapshot
              ? `${receiverSnapshots.nameSnapshot}`
              : newStr;
          }
        }
        changeLogRows.push({
          order_id: orderId,
          field_name: dbField,
          old_value: resolvedOld,
          new_value: resolvedNew,
          changed_by_user_id: userId,
        });
      }
    }
  }

  if (changeLogRows.length > 0) {
    const { error: bizLogErr } = await supabase.from("order_change_log").insert(changeLogRows);
    if (bizLogErr) throw bizLogErr;
  }

  // M-02: Pobierz rzeczywisty updated_at z DB (nie Date.now()) — spójność z optimistic concurrency
  const { data: refreshed } = await supabase
    .from("transport_orders")
    .select("updated_at")
    .eq("id", orderId)
    .single();

  return {
    id: orderId,
    orderNo: order.order_no,
    statusCode: newStatusCode,
    updatedAt: refreshed?.updated_at ?? new Date().toISOString(),
  };
}

/** Statusy dozwolone do „przygotuj email” (wysłanie). */
const PREPARE_EMAIL_ALLOWED_STATUSES = new Set([
  "robocze",
  "korekta",
  "wysłane",
  "korekta wysłane",
]);

/** Mapowanie status → nowy status przy wysłaniu. */
const PREPARE_EMAIL_STATUS_TRANSITION: Record<string, string> = {
  robocze: "wysłane",
  korekta: "korekta wysłane",
  wysłane: "wysłane",
  "korekta wysłane": "korekta wysłane",
};

export type PrepareEmailResult =
  | { success: true; data: PrepareEmailResponseDto }
  | { success: false; validationErrors: string[] }
  | null;

/**
 * Walidacja biznesowa i przygotowanie zlecenia do wysyłki email (zmiana statusu, sent_at, mailto).
 * Zwraca null gdy zlecenie nie istnieje; { success: false, validationErrors } przy 422; { success: true, data } przy 200.
 *
 * @param supabase — klient Supabase
 * @param userId — id użytkownika (sent_by_user_id)
 * @param orderId — UUID zlecenia
 * @param _params — prepareEmailSchema (forceRegeneratePdf — na razie nieużywane, stub PDF)
 */
export async function prepareEmailForOrder(
  supabase: SupabaseClient<Database>,
  userId: string,
  orderId: string,
  _params: PrepareEmailParams
): Promise<PrepareEmailResult> {
  const detail = await getOrderDetail(supabase, orderId);
  if (!detail) return null;

  const { order, stops, items } = detail;

  // Najpierw sprawdź status — nie ma sensu walidować pól dla niedozwolonego statusu
  if (!PREPARE_EMAIL_ALLOWED_STATUSES.has(order.statusCode)) {
    throw new Error("NOT_ALLOWED_STATUS");
  }

  const validationErrors: string[] = [];

  if (!order.transportTypeCode?.trim()) validationErrors.push("transport_type_code");
  if (!order.carrierCompanyId) validationErrors.push("carrier_company_id");
  if (!order.shipperLocationId) validationErrors.push("shipper_location_id");
  if (!order.receiverLocationId) validationErrors.push("receiver_location_id");
  if (order.priceAmount == null || order.priceAmount < 0) validationErrors.push("price_amount");

  const hasValidItem = items.some(
    (i) => (i.productNameSnapshot?.trim() ?? "") !== "" && i.quantityTons != null && i.quantityTons > 0
  );
  if (!hasValidItem) validationErrors.push("items (minimum 1 pozycja z nazwą i ilością)");

  const loadingStops = stops.filter((s) => s.kind === "LOADING");
  const unloadingStops = stops.filter((s) => s.kind === "UNLOADING");
  const hasLoadingWithDateTime = loadingStops.some(
    (s) => (s.dateLocal?.trim() ?? "") !== "" && (s.timeLocal?.trim() ?? "") !== ""
  );
  const hasUnloadingWithDateTime = unloadingStops.some(
    (s) => (s.dateLocal?.trim() ?? "") !== "" && (s.timeLocal?.trim() ?? "") !== ""
  );
  if (!hasLoadingWithDateTime) validationErrors.push("stops (minimum 1 załadunek z datą i godziną)");
  if (!hasUnloadingWithDateTime) validationErrors.push("stops (minimum 1 rozładunek z datą i godziną)");

  if (validationErrors.length > 0) {
    return { success: false, validationErrors };
  }

  const newStatusCode = PREPARE_EMAIL_STATUS_TRANSITION[order.statusCode] ?? order.statusCode;
  const now = new Date().toISOString();

  const updatePayload: Record<string, unknown> = {
    sent_by_user_id: userId,
    sent_at: now,
    status_code: newStatusCode,
  };
  if (!order.mainProductName?.trim()) {
    const firstItem = items.find((i) => (i.productNameSnapshot?.trim() ?? "") !== "");
    if (firstItem?.productNameSnapshot) {
      (updatePayload as Record<string, unknown>).main_product_name = firstItem.productNameSnapshot.trim();
    }
  }

  // Zabezpieczenie TOCTOU: UPDATE z warunkiem na status_code.
  // Jeśli między odczytem a zapisem inny proces zmienił status, count === 0.
  type OrderUpdate = Database["public"]["Tables"]["transport_orders"]["Update"];
  const { error: updateError, count } = await supabase
    .from("transport_orders")
    .update(updatePayload as OrderUpdate, { count: "exact" })
    .eq("id", orderId)
    .eq("status_code", order.statusCode);

  if (updateError) throw updateError;

  if (count === 0) {
    throw new Error("STATUS_CHANGED");
  }

  if (newStatusCode !== order.statusCode) {
    const { error: historyErr } = await supabase.from("order_status_history").insert({
      order_id: orderId,
      old_status_code: order.statusCode,
      new_status_code: newStatusCode,
      changed_by_user_id: userId,
    });
    if (historyErr) throw historyErr;

    // Wpis do logu zmian pola status_code (spójność z changeStatus)
    const { error: logErr } = await supabase.from("order_change_log").insert({
      order_id: orderId,
      field_name: "status_code",
      old_value: order.statusCode,
      new_value: newStatusCode,
      changed_by_user_id: userId,
    });
    if (logErr) throw logErr;
  }

  const subject = encodeURIComponent(`Zlecenie ${order.orderNo}`);
  const emailOpenUrl = `mailto:?subject=${subject}`;

  return {
    success: true,
    data: {
      orderId,
      statusBefore: order.statusCode,
      statusAfter: newStatusCode,
      emailOpenUrl,
      pdfFileName: null,
    },
  };
}

/**
 * Częściowa edycja pojedynczego punktu trasy. Sprawdza blokadę (409).
 * Przelicza first/last loading/unloading na zleceniu po zapisie.
 *
 * @param supabase — klient Supabase
 * @param userId — id użytkownika (do sprawdzenia blokady)
 * @param orderId — UUID zlecenia
 * @param stopId — UUID punktu trasy
 * @param params — tylko podane pola (patch)
 * @returns PatchStopResponseDto lub null gdy zlecenie/stop nie istnieje; rzuca LOCKED
 */
export async function patchStop(
  supabase: SupabaseClient<Database>,
  userId: string,
  orderId: string,
  stopId: string,
  params: PatchStopParams
): Promise<PatchStopResponseDto | null> {
  const { data: order, error: orderErr } = await supabase
    .from("transport_orders")
    .select("id, locked_by_user_id, status_code")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr) throw orderErr;
  if (!order) return null;

  if (order.locked_by_user_id != null && order.locked_by_user_id !== userId) {
    throw new Error("LOCKED");
  }

  // Blokuj edycję stopów w zleceniach readonly (zrealizowane/anulowane)
  if (READONLY_STATUSES.has(order.status_code)) {
    throw new Error("READONLY");
  }

  // Auto-korekta: edycja stopu w zleceniu wysłanym zmienia status na "korekta"
  const shouldAutoKorekta = AUTO_KOREKTA_FROM.has(order.status_code);

  const { data: stop, error: stopErr } = await supabase
    .from("order_stops")
    .select("id, order_id, kind, sequence_no, date_local, time_local, location_id, notes")
    .eq("id", stopId)
    .eq("order_id", orderId)
    .maybeSingle();

  if (stopErr) throw stopErr;
  if (!stop) return null;

  // M-04: Walidacja kolejności trasy przy zmianie kind (pierwszy stop = LOADING, ostatni = UNLOADING)
  if (params.kind !== undefined) {
    const { data: currentStops } = await supabase
      .from("order_stops")
      .select("id, kind, sequence_no")
      .eq("order_id", orderId)
      .order("sequence_no", { ascending: true });

    if (currentStops && currentStops.length > 0) {
      // Symuluj zmianę kind dla patchowanego stopu
      const simulated = currentStops.map((s) =>
        s.id === stopId ? { ...s, kind: params.kind! } : s
      );
      if (simulated[0].kind !== "LOADING") {
        throw new Error("INVALID_ROUTE_ORDER");
      }
      if (simulated[simulated.length - 1].kind !== "UNLOADING") {
        throw new Error("INVALID_ROUTE_ORDER");
      }
    }
  }

  const stopUpdatePayload: Record<string, unknown> = {};
  if (params.kind !== undefined) stopUpdatePayload.kind = params.kind;
  if (params.dateLocal !== undefined) stopUpdatePayload.date_local = params.dateLocal;
  if (params.timeLocal !== undefined) stopUpdatePayload.time_local = params.timeLocal;
  if (params.locationId !== undefined) stopUpdatePayload.location_id = params.locationId;
  if (params.notes !== undefined) stopUpdatePayload.notes = params.notes;

  // Update location snapshots when locationId changes
  if (params.locationId !== undefined && params.locationId) {
    const snap = await buildSnapshotsForLocation(supabase, params.locationId);
    stopUpdatePayload.location_name_snapshot = snap.locationNameSnapshot;
    stopUpdatePayload.company_name_snapshot = snap.companyNameSnapshot;
    stopUpdatePayload.address_snapshot = snap.addressSnapshot;
  } else if (params.locationId === null) {
    stopUpdatePayload.location_name_snapshot = null;
    stopUpdatePayload.company_name_snapshot = null;
    stopUpdatePayload.address_snapshot = null;
  }

  if (Object.keys(stopUpdatePayload).length > 0) {
    type StopUpdate = Database["public"]["Tables"]["order_stops"]["Update"];
    const { error: updErr } = await supabase
      .from("order_stops")
      .update(stopUpdatePayload as StopUpdate)
      .eq("id", stopId)
      .eq("order_id", orderId);
    if (updErr) throw updErr;

    // P-01: Logowanie zmian poszczególnych pól stopu do order_change_log
    const fieldMap: Array<{ param: keyof PatchStopParams; dbField: string; oldVal: unknown }> = [
      { param: "dateLocal", dbField: "date_local", oldVal: stop.date_local },
      { param: "timeLocal", dbField: "time_local", oldVal: stop.time_local },
      { param: "notes", dbField: "notes", oldVal: stop.notes },
    ];
    const changeLogRows: Array<{
      order_id: string;
      field_name: string;
      old_value: string | null;
      new_value: string | null;
      changed_by_user_id: string;
    }> = [];
    for (const { param, dbField, oldVal } of fieldMap) {
      if (params[param] !== undefined) {
        const oldStr = oldVal != null ? String(oldVal) : null;
        const newStr = params[param] != null ? String(params[param]) : null;
        if (oldStr !== newStr) {
          changeLogRows.push({
            order_id: orderId,
            field_name: `stop.${dbField}`,
            old_value: oldStr,
            new_value: newStr,
            changed_by_user_id: userId,
          });
        }
      }
    }

    // Specjalna obsługa location_id — zapisz nazwę zamiast UUID
    if (params.locationId !== undefined) {
      const oldLocId = stop.location_id;
      const newLocId = params.locationId;
      const oldStr = oldLocId ?? null;
      const newStr = newLocId ?? null;
      if (oldStr !== newStr) {
        let resolvedOld: string | null = null;
        let resolvedNew: string | null = null;
        if (oldLocId) {
          const { data: oldLoc } = await supabase
            .from("locations")
            .select("name, companies(name)")
            .eq("id", oldLocId)
            .maybeSingle();
          const oldCompany = (oldLoc?.companies as { name: string } | null)?.name;
          resolvedOld = oldCompany ? `${oldCompany} — ${oldLoc?.name}` : oldLoc?.name ?? oldLocId;
        }
        if (newLocId) {
          // Snapshot już pobrany wyżej w stopUpdatePayload
          const newName = stopUpdatePayload.location_name_snapshot as string | null;
          const newCompany = stopUpdatePayload.company_name_snapshot as string | null;
          resolvedNew = newCompany ? `${newCompany} — ${newName}` : newName ?? newLocId;
        }
        changeLogRows.push({
          order_id: orderId,
          field_name: `stop.location_id`,
          old_value: resolvedOld,
          new_value: resolvedNew,
          changed_by_user_id: userId,
        });
      }
    }

    if (changeLogRows.length > 0) {
      const { error: logErr } = await supabase.from("order_change_log").insert(changeLogRows);
      if (logErr) throw logErr;
    }
  }

  const { data: allStops } = await supabase
    .from("order_stops")
    .select("kind, date_local, time_local, location_name_snapshot, location_id, locations(country)")
    .eq("order_id", orderId)
    .order("sequence_no", { ascending: true });

  const stopsForDenorm = (allStops ?? []).map((s) => ({
    kind: s.kind,
    dateLocal: s.date_local,
    timeLocal: s.time_local,
    locationNameSnapshot: s.location_name_snapshot,
    country: (s.locations as { country: string | null } | null)?.country ?? null,
  }));
  const denorm = computeDenormalizedFields(stopsForDenorm, []);

  // P-04: Atomic denormalization UPDATE z guardem na READONLY_STATUSES + lock ownership
  type OrderUpdate = Database["public"]["Tables"]["transport_orders"]["Update"];
  const { error: denormErr, count: denormCount } = await supabase
    .from("transport_orders")
    .update(
      {
        first_loading_date: denorm.first_loading_date,
        first_loading_time: denorm.first_loading_time,
        first_unloading_date: denorm.first_unloading_date,
        first_unloading_time: denorm.first_unloading_time,
        last_loading_date: denorm.last_loading_date,
        last_loading_time: denorm.last_loading_time,
        last_unloading_date: denorm.last_unloading_date,
        last_unloading_time: denorm.last_unloading_time,
        first_loading_country: denorm.first_loading_country,
        first_unloading_country: denorm.first_unloading_country,
        summary_route: denorm.summary_route,
        ...(shouldAutoKorekta ? { status_code: STATUS_KOREKTA } : {}),
      } as OrderUpdate,
      { count: "exact" }
    )
    .eq("id", orderId)
    .or(`locked_by_user_id.is.null,locked_by_user_id.eq.${userId}`)
    .not("status_code", "in", "(zrealizowane,anulowane)");
  if (denormErr) throw denormErr;
  // Jeśli UPDATE nie trafił żadnego wiersza — zlecenie zostało zrealizowane/anulowane równolegle
  if (!denormCount || denormCount === 0) {
    throw new Error("FORBIDDEN_EDIT");
  }

  // P-02: Wpis do order_status_history przy auto-korekcie
  if (shouldAutoKorekta) {
    const { error: histErr } = await supabase.from("order_status_history").insert({
      order_id: orderId,
      old_status_code: order.status_code,
      new_status_code: STATUS_KOREKTA,
      changed_by_user_id: userId,
    });
    if (histErr) throw histErr;
  }

  const merged = {
    kind: params.kind ?? stop.kind,
    dateLocal: params.dateLocal !== undefined ? params.dateLocal : stop.date_local,
    timeLocal: params.timeLocal !== undefined ? params.timeLocal : stop.time_local,
    locationId: params.locationId !== undefined ? params.locationId : stop.location_id,
    notes: params.notes !== undefined ? params.notes : stop.notes,
  };

  return {
    id: stopId,
    orderId,
    kind: merged.kind,
    sequenceNo: stop.sequence_no,
    dateLocal: merged.dateLocal,
    timeLocal: merged.timeLocal,
    locationId: merged.locationId,
    notes: merged.notes,
  };
}

/**
 * Ustawia kolor komórki "Firma transportowa" na zleceniu.
 * Prosty UPDATE bez blokady — operacja dekoracyjna (nie zmienia danych biznesowych).
 *
 * @param supabase — klient Supabase
 * @param orderId — UUID zlecenia
 * @param color — hex color lub null (usunięcie koloru)
 * @returns { id, carrierCellColor } lub null gdy zlecenie nie istnieje
 */
export async function updateCarrierCellColor(
  supabase: SupabaseClient<Database>,
  orderId: string,
  color: string | null
): Promise<{ id: string; carrierCellColor: string | null } | null> {
  type OrderUpdate = Database["public"]["Tables"]["transport_orders"]["Update"];
  const { error, count } = await supabase
    .from("transport_orders")
    .update({ carrier_cell_color: color } as OrderUpdate, { count: "exact" })
    .eq("id", orderId);

  if (error) throw error;
  if (!count || count === 0) return null;

  return { id: orderId, carrierCellColor: color };
}

/**
 * Aktualizuje pole is_entry_fixed (Fix) zlecenia i loguje zmianę w order_change_log.
 */
export async function updateEntryFixed(
  supabase: SupabaseClient<Database>,
  orderId: string,
  userId: string,
  isEntryFixed: boolean | null
): Promise<{ id: string; isEntryFixed: boolean | null } | null> {
  // Pobierz starą wartość do logu zmian
  const { data: oldRow, error: fetchErr } = await supabase
    .from("transport_orders")
    .select("is_entry_fixed")
    .eq("id", orderId)
    .single();

  if (fetchErr || !oldRow) return null;

  const oldValue = (oldRow as { is_entry_fixed?: boolean | null }).is_entry_fixed ?? null;

  // Aktualizuj pole
  type OrderUpdate = Database["public"]["Tables"]["transport_orders"]["Update"];
  const { error, count } = await supabase
    .from("transport_orders")
    .update({ is_entry_fixed: isEntryFixed } as OrderUpdate, { count: "exact" })
    .eq("id", orderId);

  if (error) throw error;
  if (!count || count === 0) return null;

  // Loguj zmianę w order_change_log
  const formatValue = (v: boolean | null): string | null =>
    v === true ? "true" : v === false ? "false" : null;

  if (oldValue !== isEntryFixed) {
    await supabase.from("order_change_log").insert({
      order_id: orderId,
      changed_by_user_id: userId,
      field_name: "is_entry_fixed",
      old_value: formatValue(oldValue),
      new_value: formatValue(isEntryFixed),
    });
  }

  return { id: orderId, isEntryFixed };
}
