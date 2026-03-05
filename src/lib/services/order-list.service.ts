/**
 * Serwis listy zleceń — listOrders z filtrami, sortowaniem i paginacją.
 * Wyekstrahowany z order.service.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types";
import type {
  OrderListItemDto,
  OrderListItemInnerDto,
  OrderListResponseDto,
  OrderListStopDto,
} from "../../types";
import type { OrderListQueryParams } from "../validators/order.validator";

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
