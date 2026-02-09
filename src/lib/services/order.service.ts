import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type {
  OrderListItemDto,
  OrderListResponseDto,
  OrderStatusCode,
  ViewGroup,
  CurrencyCode,
  OrderDetailResponseDto,
  OrderDetailDto,
  OrderDetailStopDto,
  OrderDetailItemDto,
  StopKind,
  CreateOrderResponseDto,
  UpdateOrderResponseDto,
  DeleteOrderResponseDto,
  ChangeStatusResponseDto,
  LockOrderResponseDto,
  UnlockOrderResponseDto,
  DuplicateOrderResponseDto,
  OrderDetailStopDto as PatchStopResponseDto,
  StatusHistoryItemDto,
  ChangeLogItemDto,
} from "../../types";
import type { OrderListQueryInput } from "../schemas/order-list.schema";
import type { CreateOrderInput } from "../schemas/create-order.schema";
import type { UpdateOrderInput } from "../schemas/update-order.schema";
import type { ChangeStatusInput } from "../schemas/change-status.schema";
import type { RestoreOrderInput } from "../schemas/restore-order.schema";
import type { DuplicateOrderInput } from "../schemas/duplicate-order.schema";
import type { PatchStopInput } from "../schemas/patch-stop.schema";
import {
  ALLOWED_MANUAL_STATUS_TRANSITIONS,
  RESTORABLE_STATUSES,
  LOCK_TIMEOUT_MINUTES,
} from "../config";
import { generateOrderNo } from "../helpers/order-no-generator";
import {
  resolveCarrierSnapshot,
  resolveLocationSnapshot,
  resolveStopSnapshot,
  resolveProductSnapshot,
} from "../helpers/resolve-snapshots";
import { updateDenormalizedFields } from "../helpers/denormalize-order";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escapes special ILIKE characters */
function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Maps sortBy enum values to actual database column names.
 */
function mapSortColumn(
  sortBy: string
): string {
  const mapping: Record<string, string> = {
    FIRST_LOADING_DATETIME: "first_loading_date",
    FIRST_UNLOADING_DATETIME: "first_unloading_date",
    ORDER_NO: "order_no",
    CARRIER_NAME: "carrier_name_snapshot",
  };
  return mapping[sortBy] ?? "first_loading_date";
}

// ---------------------------------------------------------------------------
// GET /api/v1/orders — list
// ---------------------------------------------------------------------------

/**
 * Returns a paginated, filtered, sorted list of transport orders.
 *
 * The query joins transport_orders with:
 * - order_statuses (for statusName, viewGroup)
 * - transport_types (for transportTypeName)
 * - vehicle_variants (for vehicleVariantName)
 * - user_profiles (3x — createdBy, updatedBy, lockedBy for display names)
 *
 * Sub-queries for productId, loadingLocationId, unloadingLocationId use
 * Supabase .filter() with RPC or client-side post-filtering. Since Supabase
 * JS client does not support EXISTS sub-queries directly, we use .in() with
 * a pre-fetched list of order_ids for those filters.
 */
export async function listOrders(
  supabase: SupabaseClient<Database>,
  params: OrderListQueryInput
): Promise<OrderListResponseDto> {
  // ---- Step 1: Resolve order_ids for sub-query filters (product, location) ----
  let subFilterOrderIds: string[] | null = null;

  if (params.productId) {
    const { data } = await supabase
      .from("order_items")
      .select("order_id")
      .eq("product_id", params.productId);
    subFilterOrderIds = [...new Set((data ?? []).map((r) => r.order_id))];
  }

  if (params.loadingLocationId) {
    const { data } = await supabase
      .from("order_stops")
      .select("order_id")
      .eq("location_id", params.loadingLocationId)
      .eq("kind", "LOADING");
    const ids = [...new Set((data ?? []).map((r) => r.order_id))];
    subFilterOrderIds = subFilterOrderIds
      ? subFilterOrderIds.filter((id) => ids.includes(id))
      : ids;
  }

  if (params.unloadingLocationId) {
    const { data } = await supabase
      .from("order_stops")
      .select("order_id")
      .eq("location_id", params.unloadingLocationId)
      .eq("kind", "UNLOADING");
    const ids = [...new Set((data ?? []).map((r) => r.order_id))];
    subFilterOrderIds = subFilterOrderIds
      ? subFilterOrderIds.filter((id) => ids.includes(id))
      : ids;
  }

  // If sub-filters resolved to empty set, return empty result immediately
  if (subFilterOrderIds !== null && subFilterOrderIds.length === 0) {
    return { items: [], page: params.page, pageSize: params.pageSize, totalItems: 0, totalPages: 0 };
  }

  // ---- Step 2: Build main query with Supabase nested selects ----
  const selectFields = `
    id,
    order_no,
    status_code,
    transport_type_code,
    summary_route,
    first_loading_date,
    first_loading_time,
    first_unloading_date,
    first_unloading_time,
    carrier_company_id,
    carrier_name_snapshot,
    price_amount,
    currency_code,
    vehicle_variant_code,
    required_documents_text,
    general_notes,
    locked_by_user_id,
    locked_at,
    created_at,
    created_by_user_id,
    updated_at,
    updated_by_user_id,
    order_statuses!transport_orders_status_code_fkey (name, view_group),
    transport_types!transport_orders_transport_type_code_fkey (name),
    vehicle_variants!transport_orders_vehicle_variant_code_fkey (name),
    created_by:user_profiles!transport_orders_created_by_user_id_fkey (full_name),
    updated_by:user_profiles!transport_orders_updated_by_user_id_fkey (full_name),
    locked_by:user_profiles!transport_orders_locked_by_user_id_fkey (full_name)
  `;

  let query = supabase
    .from("transport_orders")
    .select(selectFields, { count: "exact" });

  // ---- Step 3: Apply filters ----

  // View group filter (via join)
  query = query.eq("order_statuses.view_group", params.view);

  // Status code filter
  const statuses = params.status;
  if (statuses) {
    const statusArray = Array.isArray(statuses) ? statuses : [statuses];
    query = query.in("status_code", statusArray);
  }

  // Transport type filter
  if (params.transportType) {
    query = query.eq("transport_type_code", params.transportType);
  }

  // Carrier filter
  if (params.carrierId) {
    query = query.eq("carrier_company_id", params.carrierId);
  }

  // Sub-filter by order_ids (product, loading/unloading location)
  if (subFilterOrderIds !== null) {
    query = query.in("id", subFilterOrderIds);
  }

  // Date range filter — on first_loading_date
  if (params.dateFrom) {
    query = query.gte("first_loading_date", params.dateFrom);
  }
  if (params.dateTo) {
    query = query.lte("first_loading_date", params.dateTo);
  }

  // Search — ILIKE on search_text
  if (params.search) {
    query = query.ilike("search_text", `%${escapeIlike(params.search)}%`);
  }

  // ---- Step 4: Sorting ----
  const sortColumn = mapSortColumn(params.sortBy);
  const ascending = params.sortDirection === "ASC";
  query = query.order(sortColumn, { ascending, nullsFirst: false });

  // ---- Step 5: Pagination ----
  const offset = (params.page - 1) * params.pageSize;
  query = query.range(offset, offset + params.pageSize - 1);

  // ---- Step 6: Execute ----
  const { data, error, count } = await query;

  if (error) throw error;

  // ---- Step 7: Fetch last loading/unloading dates + main product names ----
  // We need these from order_stops and order_items for display
  const orderIds = (data ?? []).map((r) => r.id);

  // Parallel fetches for additional data
  const [stopsResult, itemsResult] = await Promise.all([
    orderIds.length > 0
      ? supabase
          .from("order_stops")
          .select("order_id, kind, date_local, time_local, sequence_no")
          .in("order_id", orderIds)
          .order("sequence_no", { ascending: false })
      : Promise.resolve({ data: [] as Array<{ order_id: string; kind: string; date_local: string | null; time_local: string | null; sequence_no: number }>, error: null }),
    orderIds.length > 0
      ? supabase
          .from("order_items")
          .select("order_id, product_name_snapshot")
          .in("order_id", orderIds)
      : Promise.resolve({ data: [] as Array<{ order_id: string; product_name_snapshot: string | null }>, error: null }),
  ]);

  // Build lookup maps for last loading/unloading stops
  const lastLoadingMap = new Map<string, { date: string | null; time: string | null }>();
  const lastUnloadingMap = new Map<string, { date: string | null; time: string | null }>();

  for (const stop of stopsResult.data ?? []) {
    if (stop.kind === "LOADING" && !lastLoadingMap.has(stop.order_id)) {
      lastLoadingMap.set(stop.order_id, {
        date: stop.date_local,
        time: stop.time_local,
      });
    }
    if (stop.kind === "UNLOADING" && !lastUnloadingMap.has(stop.order_id)) {
      lastUnloadingMap.set(stop.order_id, {
        date: stop.date_local,
        time: stop.time_local,
      });
    }
  }

  // Build lookup for first product name per order
  const mainProductMap = new Map<string, string | null>();
  for (const item of itemsResult.data ?? []) {
    if (!mainProductMap.has(item.order_id)) {
      mainProductMap.set(item.order_id, item.product_name_snapshot);
    }
  }

  // ---- Step 8: Map to DTOs ----
  const totalItems = count ?? 0;
  const totalPages = Math.ceil(totalItems / params.pageSize);

  // Type for joined row — Supabase returns nested objects for joins
  type JoinedRow = NonNullable<typeof data>[number];

  const items: OrderListItemDto[] = (data ?? []).map((row: JoinedRow) => {
    // Supabase nested select returns object (single) or array
    const statusInfo = row.order_statuses as unknown as { name: string; view_group: string } | null;
    const transportTypeInfo = row.transport_types as unknown as { name: string } | null;
    const vehicleVariantInfo = row.vehicle_variants as unknown as { name: string } | null;
    const createdByInfo = row.created_by as unknown as { full_name: string | null } | null;
    const updatedByInfo = row.updated_by as unknown as { full_name: string | null } | null;
    const lockedByInfo = row.locked_by as unknown as { full_name: string | null } | null;

    const lastLoading = lastLoadingMap.get(row.id);
    const lastUnloading = lastUnloadingMap.get(row.id);

    return {
      id: row.id,
      orderNo: row.order_no,
      statusCode: row.status_code as OrderStatusCode,
      statusName: statusInfo?.name ?? "",
      viewGroup: (statusInfo?.view_group ?? "CURRENT") as ViewGroup,
      transportTypeCode: row.transport_type_code,
      transportTypeName: transportTypeInfo?.name ?? "",
      summaryRoute: row.summary_route,
      firstLoadingDate: row.first_loading_date,
      firstLoadingTime: row.first_loading_time,
      firstUnloadingDate: row.first_unloading_date,
      firstUnloadingTime: row.first_unloading_time,
      lastLoadingDate: lastLoading?.date ?? null,
      lastLoadingTime: lastLoading?.time ?? null,
      lastUnloadingDate: lastUnloading?.date ?? null,
      lastUnloadingTime: lastUnloading?.time ?? null,
      carrierCompanyId: row.carrier_company_id,
      carrierName: row.carrier_name_snapshot,
      mainProductName: mainProductMap.get(row.id) ?? null,
      priceAmount: row.price_amount,
      currencyCode: row.currency_code as CurrencyCode,
      vehicleVariantCode: row.vehicle_variant_code,
      vehicleVariantName: vehicleVariantInfo?.name ?? "",
      requiredDocumentsText: row.required_documents_text,
      generalNotes: row.general_notes,
      lockedByUserId: row.locked_by_user_id,
      lockedByUserName: lockedByInfo?.full_name ?? null,
      lockedAt: row.locked_at,
      createdAt: row.created_at,
      createdByUserId: row.created_by_user_id,
      createdByUserName: createdByInfo?.full_name ?? null,
      updatedAt: row.updated_at,
      updatedByUserId: row.updated_by_user_id,
      updatedByUserName: updatedByInfo?.full_name ?? null,
    };
  });

  // ---- Step 9: Filter by view_group on client side ----
  // The .eq("order_statuses.view_group", ...) filter on a joined table
  // in Supabase only filters the *joined rows*, not the parent rows.
  // We need to filter the results to only include orders whose status
  // belongs to the requested view group.
  const filteredItems = items.filter((item) => item.viewGroup === params.view);

  return {
    items: filteredItems,
    page: params.page,
    pageSize: params.pageSize,
    totalItems: filteredItems.length < params.pageSize ? ((params.page - 1) * params.pageSize) + filteredItems.length : totalItems,
    totalPages,
  };
}

// ---------------------------------------------------------------------------
// GET /api/v1/orders/{orderId} — detail
// ---------------------------------------------------------------------------

/**
 * Returns full order details (header + stops + items) for the detail view.
 */
export async function getOrderById(
  supabase: SupabaseClient<Database>,
  orderId: string
): Promise<OrderDetailResponseDto | null> {
  // Single query with nested selects
  const { data, error } = await supabase
    .from("transport_orders")
    .select(
      `
      *,
      order_stops (*),
      order_items (*)
    `
    )
    .eq("id", orderId)
    .single();

  if (error) {
    // PGRST116 = no rows found
    if (error.code === "PGRST116") return null;
    throw error;
  }

  if (!data) return null;

  // Map order header to OrderDetailDto (snake_case → camelCase)
  const order: OrderDetailDto = {
    id: data.id,
    orderNo: data.order_no,
    statusCode: data.status_code as OrderStatusCode,
    transportTypeCode: data.transport_type_code,
    currencyCode: data.currency_code as CurrencyCode,
    priceAmount: data.price_amount,
    paymentTermDays: null, // Reserved — not in DB yet
    paymentMethod: null, // Reserved — not in DB yet
    totalLoadTons: data.total_load_tons,
    totalLoadVolumeM3: null, // Reserved — not in DB yet
    summaryRoute: data.summary_route,
    firstLoadingDate: data.first_loading_date,
    firstLoadingTime: data.first_loading_time,
    firstUnloadingDate: data.first_unloading_date,
    firstUnloadingTime: data.first_unloading_time,
    lastLoadingDate: null, // Computed below from stops
    lastLoadingTime: null,
    lastUnloadingDate: null,
    lastUnloadingTime: null,
    transportYear: data.transport_year,
    firstLoadingCountry: data.first_loading_country,
    firstUnloadingCountry: data.first_unloading_country,
    carrierCompanyId: data.carrier_company_id,
    carrierNameSnapshot: data.carrier_name_snapshot,
    carrierLocationNameSnapshot: data.carrier_location_name_snapshot,
    carrierAddressSnapshot: data.carrier_address_snapshot,
    shipperLocationId: data.shipper_location_id,
    shipperNameSnapshot: data.shipper_name_snapshot,
    shipperAddressSnapshot: data.shipper_address_snapshot,
    receiverLocationId: data.receiver_location_id,
    receiverNameSnapshot: data.receiver_name_snapshot,
    receiverAddressSnapshot: data.receiver_address_snapshot,
    vehicleVariantCode: data.vehicle_variant_code,
    specialRequirements: null, // Reserved — not in DB yet
    requiredDocumentsText: data.required_documents_text,
    generalNotes: data.general_notes,
    complaintReason: data.complaint_reason,
    senderContactName: data.sender_contact_name,
    senderContactPhone: data.sender_contact_phone,
    senderContactEmail: data.sender_contact_email,
    createdAt: data.created_at,
    createdByUserId: data.created_by_user_id,
    updatedAt: data.updated_at,
    updatedByUserId: data.updated_by_user_id,
    lockedByUserId: data.locked_by_user_id,
    lockedAt: data.locked_at,
  };

  // Map stops (sorted by sequence_no)
  const rawStops = (data.order_stops ?? []) as Array<{
    id: string;
    kind: string;
    sequence_no: number;
    date_local: string | null;
    time_local: string | null;
    location_id: string | null;
    location_name_snapshot: string | null;
    company_name_snapshot: string | null;
    address_snapshot: string | null;
    notes: string | null;
  }>;

  const stops: OrderDetailStopDto[] = rawStops
    .sort((a, b) => a.sequence_no - b.sequence_no)
    .map((s) => ({
      id: s.id,
      kind: s.kind as StopKind,
      sequenceNo: s.sequence_no,
      dateLocal: s.date_local,
      timeLocal: s.time_local,
      locationId: s.location_id,
      locationNameSnapshot: s.location_name_snapshot,
      companyNameSnapshot: s.company_name_snapshot,
      addressSnapshot: s.address_snapshot,
      notes: s.notes,
    }));

  // Compute last loading/unloading from stops
  const loadingStops = stops.filter((s) => s.kind === "LOADING");
  const unloadingStops = stops.filter((s) => s.kind === "UNLOADING");

  if (loadingStops.length > 0) {
    const last = loadingStops[loadingStops.length - 1];
    order.lastLoadingDate = last.dateLocal;
    order.lastLoadingTime = last.timeLocal;
  }
  if (unloadingStops.length > 0) {
    const last = unloadingStops[unloadingStops.length - 1];
    order.lastUnloadingDate = last.dateLocal;
    order.lastUnloadingTime = last.timeLocal;
  }

  // Map items
  const rawItems = (data.order_items ?? []) as Array<{
    id: string;
    product_id: string | null;
    product_name_snapshot: string | null;
    default_loading_method_snapshot: string | null;
    quantity_tons: number | null;
    notes: string | null;
  }>;

  const items: OrderDetailItemDto[] = rawItems.map((i) => ({
    id: i.id,
    productId: i.product_id,
    productNameSnapshot: i.product_name_snapshot,
    defaultLoadingMethodSnapshot: i.default_loading_method_snapshot,
    quantityTons: i.quantity_tons,
    notes: i.notes,
  }));

  return { order, stops, items };
}

// ---------------------------------------------------------------------------
// POST /api/v1/orders — create
// ---------------------------------------------------------------------------

/**
 * Creates a new transport order in draft status (ROB).
 *
 * Flow:
 * 1. Generate unique order_no
 * 2. Resolve snapshots (carrier, shipper, receiver, stops, items)
 * 3. Insert transport_orders
 * 4. Insert order_stops
 * 5. Insert order_items
 * 6. Insert initial order_status_history
 * 7. Update denormalized fields
 */
export async function createOrder(
  supabase: SupabaseClient<Database>,
  userId: string,
  command: CreateOrderInput
): Promise<CreateOrderResponseDto> {
  const year = new Date().getFullYear();
  const orderNo = await generateOrderNo(supabase, year);

  // Resolve snapshots in parallel
  const [carrierSnap, shipperSnap, receiverSnap] = await Promise.all([
    resolveCarrierSnapshot(supabase, command.carrierCompanyId),
    resolveLocationSnapshot(supabase, command.shipperLocationId),
    resolveLocationSnapshot(supabase, command.receiverLocationId),
  ]);

  // Insert order
  const { data: order, error: orderError } = await supabase
    .from("transport_orders")
    .insert({
      order_no: orderNo,
      status_code: "ROB",
      transport_type_code: command.transportTypeCode,
      currency_code: command.currencyCode,
      vehicle_variant_code: command.vehicleVariantCode,
      carrier_company_id: command.carrierCompanyId ?? null,
      shipper_location_id: command.shipperLocationId ?? null,
      receiver_location_id: command.receiverLocationId ?? null,
      price_amount: command.priceAmount ?? null,
      total_load_tons: command.totalLoadTons ?? null,
      required_documents_text: command.requiredDocumentsText ?? null,
      general_notes: command.generalNotes ?? null,
      sender_contact_name: command.senderContactName ?? null,
      sender_contact_phone: command.senderContactPhone ?? null,
      sender_contact_email: command.senderContactEmail ?? null,
      carrier_name_snapshot: carrierSnap.carrierNameSnapshot,
      carrier_location_name_snapshot: carrierSnap.carrierLocationNameSnapshot,
      carrier_address_snapshot: carrierSnap.carrierAddressSnapshot,
      shipper_name_snapshot: shipperSnap.nameSnapshot,
      shipper_address_snapshot: shipperSnap.addressSnapshot,
      receiver_name_snapshot: receiverSnap.nameSnapshot,
      receiver_address_snapshot: receiverSnap.addressSnapshot,
      created_by_user_id: userId,
    })
    .select("id, order_no, status_code, created_at")
    .single();

  if (orderError || !order) {
    throw orderError ?? new Error("Failed to create order");
  }

  // Insert stops (if any)
  if (command.stops.length > 0) {
    const stopsToInsert = await Promise.all(
      command.stops.map(async (stop, index) => {
        const snap = await resolveStopSnapshot(supabase, stop.locationId);
        return {
          order_id: order.id,
          kind: stop.kind,
          sequence_no: index + 1,
          date_local: stop.dateLocal ?? null,
          time_local: stop.timeLocal ?? null,
          location_id: stop.locationId ?? null,
          location_name_snapshot: snap.locationNameSnapshot,
          company_name_snapshot: snap.companyNameSnapshot,
          address_snapshot: snap.addressSnapshot,
          notes: stop.notes ?? null,
        };
      })
    );

    const { error: stopsError } = await supabase
      .from("order_stops")
      .insert(stopsToInsert);

    if (stopsError) {
      // Rollback — delete the order (CASCADE will remove stops)
      await supabase.from("transport_orders").delete().eq("id", order.id);
      throw stopsError;
    }
  }

  // Insert items (if any)
  if (command.items.length > 0) {
    const itemsToInsert = await Promise.all(
      command.items.map(async (item) => {
        const snap = await resolveProductSnapshot(supabase, item.productId);
        return {
          order_id: order.id,
          product_id: item.productId ?? null,
          product_name_snapshot: snap.productNameSnapshot ?? item.productNameSnapshot ?? null,
          default_loading_method_snapshot: snap.defaultLoadingMethodSnapshot,
          quantity_tons: item.quantityTons ?? null,
          notes: item.notes ?? null,
        };
      })
    );

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(itemsToInsert);

    if (itemsError) {
      await supabase.from("transport_orders").delete().eq("id", order.id);
      throw itemsError;
    }
  }

  // Insert initial status history
  await supabase.from("order_status_history").insert({
    order_id: order.id,
    old_status_code: "ROB",
    new_status_code: "ROB",
    changed_by_user_id: userId,
  });

  // Update denormalized fields (first/last dates, route, search_text)
  await updateDenormalizedFields(supabase, order.id);

  return {
    id: order.id,
    orderNo: order.order_no,
    statusCode: "ROB",
    createdAt: order.created_at,
  };
}

// ---------------------------------------------------------------------------
// PUT /api/v1/orders/{orderId} — update
// ---------------------------------------------------------------------------

/** Fields that trigger automatic WYS/KOR_WYS → KOR transition */
const BUSINESS_FIELDS = [
  "transport_type_code",
  "currency_code",
  "vehicle_variant_code",
  "carrier_company_id",
  "shipper_location_id",
  "receiver_location_id",
  "price_amount",
  "total_load_tons",
  "required_documents_text",
  "sender_contact_name",
  "sender_contact_phone",
  "sender_contact_email",
] as const;

/**
 * Full update of a transport order (header + stops + items).
 *
 * Checks:
 * - Lock: if locked by another user and lock not expired → 409
 * - Editability: if status is_editable=false → 403
 * - Auto-transition: if status ∈ {WYS, KOR_WYS} and business fields changed → KOR
 */
export async function updateOrder(
  supabase: SupabaseClient<Database>,
  userId: string,
  orderId: string,
  command: UpdateOrderInput
): Promise<UpdateOrderResponseDto | { error: string; status: number }> {
  // 1. Fetch existing order
  const { data: existing, error: fetchError } = await supabase
    .from("transport_orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      return { error: "NOT_FOUND", status: 404 };
    }
    throw fetchError;
  }

  // 2. Check lock
  if (
    existing.locked_by_user_id &&
    existing.locked_by_user_id !== userId
  ) {
    // Check if lock has expired (30 min)
    const lockTime = new Date(existing.locked_at!).getTime();
    const now = Date.now();
    const LOCK_TIMEOUT_MS = 30 * 60 * 1000;
    if (now - lockTime < LOCK_TIMEOUT_MS) {
      return { error: "LOCKED", status: 409 };
    }
  }

  // 3. Check status editability
  const { data: statusInfo } = await supabase
    .from("order_statuses")
    .select("is_editable")
    .eq("code", existing.status_code)
    .single();

  if (statusInfo && !statusInfo.is_editable) {
    return { error: "STATUS_NOT_EDITABLE", status: 403 };
  }

  // 4. Detect business field changes for auto-transition
  let newStatusCode = existing.status_code;
  const changedFields: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];

  const fieldMapping: Record<string, keyof typeof command> = {
    transport_type_code: "transportTypeCode",
    currency_code: "currencyCode",
    vehicle_variant_code: "vehicleVariantCode",
    carrier_company_id: "carrierCompanyId",
    shipper_location_id: "shipperLocationId",
    receiver_location_id: "receiverLocationId",
    price_amount: "priceAmount",
    total_load_tons: "totalLoadTons",
    required_documents_text: "requiredDocumentsText",
    sender_contact_name: "senderContactName",
    sender_contact_phone: "senderContactPhone",
    sender_contact_email: "senderContactEmail",
  };

  for (const dbField of BUSINESS_FIELDS) {
    const cmdField = fieldMapping[dbField];
    const oldVal = String(existing[dbField] ?? "");
    const newVal = String((command as Record<string, unknown>)[cmdField] ?? "");
    if (oldVal !== newVal) {
      changedFields.push({
        field: dbField,
        oldValue: existing[dbField] != null ? String(existing[dbField]) : null,
        newValue: (command as Record<string, unknown>)[cmdField] != null
          ? String((command as Record<string, unknown>)[cmdField])
          : null,
      });
    }
  }

  // Auto-transition: WYS/KOR_WYS → KOR if business fields changed
  if (
    changedFields.length > 0 &&
    (existing.status_code === "WYS" || existing.status_code === "KOR_WYS")
  ) {
    newStatusCode = "KOR";
  }

  // 5. Resolve snapshots
  const [carrierSnap, shipperSnap, receiverSnap] = await Promise.all([
    resolveCarrierSnapshot(supabase, command.carrierCompanyId),
    resolveLocationSnapshot(supabase, command.shipperLocationId),
    resolveLocationSnapshot(supabase, command.receiverLocationId),
  ]);

  // 6. Update order header
  const { error: updateError } = await supabase
    .from("transport_orders")
    .update({
      transport_type_code: command.transportTypeCode,
      currency_code: command.currencyCode,
      vehicle_variant_code: command.vehicleVariantCode,
      carrier_company_id: command.carrierCompanyId ?? null,
      shipper_location_id: command.shipperLocationId ?? null,
      receiver_location_id: command.receiverLocationId ?? null,
      price_amount: command.priceAmount ?? null,
      total_load_tons: command.totalLoadTons ?? null,
      required_documents_text: command.requiredDocumentsText ?? null,
      general_notes: command.generalNotes ?? null,
      complaint_reason: command.complaintReason ?? null,
      sender_contact_name: command.senderContactName ?? null,
      sender_contact_phone: command.senderContactPhone ?? null,
      sender_contact_email: command.senderContactEmail ?? null,
      carrier_name_snapshot: carrierSnap.carrierNameSnapshot,
      carrier_location_name_snapshot: carrierSnap.carrierLocationNameSnapshot,
      carrier_address_snapshot: carrierSnap.carrierAddressSnapshot,
      shipper_name_snapshot: shipperSnap.nameSnapshot,
      shipper_address_snapshot: shipperSnap.addressSnapshot,
      receiver_name_snapshot: receiverSnap.nameSnapshot,
      receiver_address_snapshot: receiverSnap.addressSnapshot,
      status_code: newStatusCode,
      updated_by_user_id: userId,
    })
    .eq("id", orderId);

  if (updateError) throw updateError;

  // 7. Sync stops — delete, update, insert
  if (command.stops) {
    const toDelete = command.stops.filter((s) => s._deleted && s.id);
    const toUpdate = command.stops.filter((s) => !s._deleted && s.id);
    const toInsert = command.stops.filter((s) => !s._deleted && !s.id);

    // Delete
    for (const stop of toDelete) {
      await supabase.from("order_stops").delete().eq("id", stop.id!);
    }

    // Update existing
    for (const stop of toUpdate) {
      const snap = await resolveStopSnapshot(supabase, stop.locationId);
      await supabase
        .from("order_stops")
        .update({
          kind: stop.kind,
          sequence_no: stop.sequenceNo,
          date_local: stop.dateLocal ?? null,
          time_local: stop.timeLocal ?? null,
          location_id: stop.locationId ?? null,
          location_name_snapshot: snap.locationNameSnapshot,
          company_name_snapshot: snap.companyNameSnapshot,
          address_snapshot: snap.addressSnapshot,
          notes: stop.notes ?? null,
        })
        .eq("id", stop.id!);
    }

    // Insert new
    for (const stop of toInsert) {
      const snap = await resolveStopSnapshot(supabase, stop.locationId);
      await supabase.from("order_stops").insert({
        order_id: orderId,
        kind: stop.kind,
        sequence_no: stop.sequenceNo,
        date_local: stop.dateLocal ?? null,
        time_local: stop.timeLocal ?? null,
        location_id: stop.locationId ?? null,
        location_name_snapshot: snap.locationNameSnapshot,
        company_name_snapshot: snap.companyNameSnapshot,
        address_snapshot: snap.addressSnapshot,
        notes: stop.notes ?? null,
      });
    }
  }

  // 8. Sync items — delete, update, insert
  if (command.items) {
    const toDelete = command.items.filter((i) => i._deleted && i.id);
    const toUpdate = command.items.filter((i) => !i._deleted && i.id);
    const toInsert = command.items.filter((i) => !i._deleted && !i.id);

    for (const item of toDelete) {
      await supabase.from("order_items").delete().eq("id", item.id!);
    }

    for (const item of toUpdate) {
      const snap = await resolveProductSnapshot(supabase, item.productId);
      await supabase
        .from("order_items")
        .update({
          product_id: item.productId ?? null,
          product_name_snapshot: snap.productNameSnapshot ?? item.productNameSnapshot ?? null,
          default_loading_method_snapshot: snap.defaultLoadingMethodSnapshot,
          quantity_tons: item.quantityTons ?? null,
          notes: item.notes ?? null,
        })
        .eq("id", item.id!);
    }

    for (const item of toInsert) {
      const snap = await resolveProductSnapshot(supabase, item.productId);
      await supabase.from("order_items").insert({
        order_id: orderId,
        product_id: item.productId ?? null,
        product_name_snapshot: snap.productNameSnapshot ?? item.productNameSnapshot ?? null,
        default_loading_method_snapshot: snap.defaultLoadingMethodSnapshot,
        quantity_tons: item.quantityTons ?? null,
        notes: item.notes ?? null,
      });
    }
  }

  // 9. Log status change if it happened
  if (newStatusCode !== existing.status_code) {
    await supabase.from("order_status_history").insert({
      order_id: orderId,
      old_status_code: existing.status_code,
      new_status_code: newStatusCode,
      changed_by_user_id: userId,
    });
  }

  // 10. Log field changes
  for (const change of changedFields) {
    await supabase.from("order_change_log").insert({
      order_id: orderId,
      field_name: change.field,
      old_value: change.oldValue,
      new_value: change.newValue,
      changed_by_user_id: userId,
    });
  }

  // 11. Update denormalized fields
  await updateDenormalizedFields(supabase, orderId);

  // Fetch updated timestamp
  const { data: updated } = await supabase
    .from("transport_orders")
    .select("updated_at")
    .eq("id", orderId)
    .single();

  return {
    id: orderId,
    statusCode: newStatusCode as OrderStatusCode,
    updatedAt: updated?.updated_at ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// DELETE /api/v1/orders/{orderId} — cancel
// ---------------------------------------------------------------------------

/**
 * Cancels an order by setting status to ANL.
 * Also releases any lock and logs the status change.
 */
export async function cancelOrder(
  supabase: SupabaseClient<Database>,
  userId: string,
  orderId: string
): Promise<DeleteOrderResponseDto | { error: string; status: number }> {
  // Fetch existing order
  const { data: existing, error: fetchError } = await supabase
    .from("transport_orders")
    .select("id, status_code")
    .eq("id", orderId)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      return { error: "NOT_FOUND", status: 404 };
    }
    throw fetchError;
  }

  // Update status to ANL + release lock
  const { error: updateError } = await supabase
    .from("transport_orders")
    .update({
      status_code: "ANL",
      locked_by_user_id: null,
      locked_at: null,
      updated_by_user_id: userId,
    })
    .eq("id", orderId);

  if (updateError) throw updateError;

  // Log status change
  await supabase.from("order_status_history").insert({
    order_id: orderId,
    old_status_code: existing.status_code,
    new_status_code: "ANL",
    changed_by_user_id: userId,
  });

  return {
    id: orderId,
    statusCode: "ANL",
  };
}

// ---------------------------------------------------------------------------
// POST /api/v1/orders/{orderId}/status — manual status change
// ---------------------------------------------------------------------------

/**
 * Manually changes the status of a transport order.
 *
 * Flow:
 * 1. Fetch the order and its current status.
 * 2. Validate the transition against ALLOWED_MANUAL_STATUS_TRANSITIONS.
 * 3. Update `transport_orders.status_code` (and `complaint_reason` if REK).
 * 4. Insert `order_status_history` record.
 * 5. Insert `order_change_log` record for the `status_code` field.
 * 6. Return old and new status codes.
 *
 * @returns ChangeStatusResponseDto on success, or an error object on failure.
 */
export async function changeOrderStatus(
  supabase: SupabaseClient<Database>,
  userId: string,
  orderId: string,
  command: ChangeStatusInput
): Promise<ChangeStatusResponseDto | { error: string; status: number; message?: string }> {
  // 1. Fetch existing order
  const { data: existing, error: fetchError } = await supabase
    .from("transport_orders")
    .select("id, status_code, complaint_reason")
    .eq("id", orderId)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      return { error: "NOT_FOUND", status: 404 };
    }
    throw fetchError;
  }

  const currentStatus = existing.status_code as OrderStatusCode;
  const targetStatus = command.newStatusCode;

  // 2. Validate transition
  const allowedTargets = ALLOWED_MANUAL_STATUS_TRANSITIONS[currentStatus];

  if (!allowedTargets) {
    // Current status is not in the map (e.g. ZRE, ANL) — no manual transitions allowed
    return {
      error: "TRANSITION_NOT_ALLOWED",
      status: 409,
      message: `Przejście ze statusu ${currentStatus} nie jest dozwolone. Użyj endpointu /restore.`,
    };
  }

  if (!allowedTargets.includes(targetStatus as OrderStatusCode)) {
    return {
      error: "TRANSITION_NOT_ALLOWED",
      status: 409,
      message: `Przejście ze statusu ${currentStatus} do ${targetStatus} jest niedozwolone`,
    };
  }

  // 3. Update order status (+ complaint_reason if REK, clear if leaving REK)
  const updatePayload: Record<string, unknown> = {
    status_code: targetStatus,
    updated_by_user_id: userId,
  };

  if (targetStatus === "REK") {
    updatePayload.complaint_reason = command.complaintReason;
  } else if (currentStatus === "REK") {
    // Leaving complaint status — clear the reason
    updatePayload.complaint_reason = null;
  }

  const { error: updateError } = await supabase
    .from("transport_orders")
    .update(updatePayload)
    .eq("id", orderId);

  if (updateError) throw updateError;

  // 4. Insert status history record
  await supabase.from("order_status_history").insert({
    order_id: orderId,
    old_status_code: currentStatus,
    new_status_code: targetStatus,
    changed_by_user_id: userId,
  });

  // 5. Insert change log for the status_code field
  await supabase.from("order_change_log").insert({
    order_id: orderId,
    field_name: "status_code",
    old_value: currentStatus,
    new_value: targetStatus,
    changed_by_user_id: userId,
  });

  // 6. Return response DTO
  return {
    id: orderId,
    oldStatusCode: currentStatus,
    newStatusCode: targetStatus as OrderStatusCode,
  };
}

// ---------------------------------------------------------------------------
// POST /api/v1/orders/{orderId}/restore — restore from ZRE / ANL
// ---------------------------------------------------------------------------

/** Maximum hours after cancellation within which restore is still allowed. */
const RESTORE_WINDOW_HOURS = 24;

/**
 * Restores an order from the "Completed" (ZRE) or "Cancelled" (ANL) tab
 * back to "Current" orders.
 *
 * Rules:
 * - Only orders with status ZRE or ANL can be restored.
 * - For ANL: restore is allowed only if less than 24 hours have passed
 *   since the order was cancelled (based on `updated_at`).
 * - complaint_reason is cleared when restoring.
 *
 * @returns ChangeStatusResponseDto on success, or an error object on failure.
 */
export async function restoreOrder(
  supabase: SupabaseClient<Database>,
  userId: string,
  orderId: string,
  command: RestoreOrderInput
): Promise<ChangeStatusResponseDto | { error: string; status: number; message?: string }> {
  // 1. Fetch existing order
  const { data: existing, error: fetchError } = await supabase
    .from("transport_orders")
    .select("id, status_code, updated_at")
    .eq("id", orderId)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      return { error: "NOT_FOUND", status: 404 };
    }
    throw fetchError;
  }

  const currentStatus = existing.status_code as OrderStatusCode;

  // 2. Check if current status allows restoration
  if (!RESTORABLE_STATUSES.includes(currentStatus)) {
    return {
      error: "RESTORE_NOT_ALLOWED",
      status: 409,
      message: `Przywracanie ze statusu ${currentStatus} jest niedozwolone. Dozwolone statusy: ${RESTORABLE_STATUSES.join(", ")}`,
    };
  }

  // 3. For ANL: check 24-hour restore window
  if (currentStatus === "ANL") {
    const cancelledAt = new Date(existing.updated_at).getTime();
    const now = Date.now();
    const windowMs = RESTORE_WINDOW_HOURS * 60 * 60 * 1000;

    if (now - cancelledAt > windowMs) {
      return {
        error: "RESTORE_WINDOW_EXPIRED",
        status: 409,
        message: "Okres przywrócenia wygasł. Zlecenie anulowane ponad 24h temu nie może zostać przywrócone.",
      };
    }
  }

  const targetStatus = command.targetStatusCode;

  // 4. Update order: set new status, clear complaint_reason
  const { error: updateError } = await supabase
    .from("transport_orders")
    .update({
      status_code: targetStatus,
      complaint_reason: null,
      updated_by_user_id: userId,
    })
    .eq("id", orderId);

  if (updateError) throw updateError;

  // 5. Insert status history record
  await supabase.from("order_status_history").insert({
    order_id: orderId,
    old_status_code: currentStatus,
    new_status_code: targetStatus,
    changed_by_user_id: userId,
  });

  // 6. Insert change log
  await supabase.from("order_change_log").insert({
    order_id: orderId,
    field_name: "status_code",
    old_value: currentStatus,
    new_value: targetStatus,
    changed_by_user_id: userId,
  });

  // 7. Return response DTO (same structure as ChangeStatusResponseDto)
  return {
    id: orderId,
    oldStatusCode: currentStatus,
    newStatusCode: targetStatus as OrderStatusCode,
  };
}

// ---------------------------------------------------------------------------
// POST /api/v1/orders/{orderId}/lock — acquire edit lock
// ---------------------------------------------------------------------------

/**
 * Acquires an edit lock on a transport order for the current user.
 *
 * Locking rules (idempotent):
 * - If the order is not locked → set lock for current user.
 * - If already locked by the same user → refresh `locked_at` (idempotent).
 * - If locked by another user and lock has NOT expired → 409 Conflict.
 * - If locked by another user and lock HAS expired → take over the lock.
 *
 * @returns LockOrderResponseDto on success, or an error object on failure.
 */
export async function lockOrder(
  supabase: SupabaseClient<Database>,
  userId: string,
  orderId: string
): Promise<LockOrderResponseDto | { error: string; status: number; message?: string }> {
  // 1. Fetch existing order with lock info
  const { data: existing, error: fetchError } = await supabase
    .from("transport_orders")
    .select("id, locked_by_user_id, locked_at")
    .eq("id", orderId)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      return { error: "NOT_FOUND", status: 404 };
    }
    throw fetchError;
  }

  // 2. Check lock state
  const lockTimeoutMs = LOCK_TIMEOUT_MINUTES * 60 * 1000;
  const now = new Date();

  if (existing.locked_by_user_id && existing.locked_by_user_id !== userId) {
    // Locked by someone else — check expiration
    const lockedAt = new Date(existing.locked_at!).getTime();
    const isExpired = now.getTime() - lockedAt > lockTimeoutMs;

    if (!isExpired) {
      return {
        error: "ALREADY_LOCKED",
        status: 409,
        message: `Zlecenie jest zablokowane przez innego użytkownika`,
      };
    }
    // Lock expired — fall through to take over
  }

  // 3. Set or refresh lock
  const lockedAt = now.toISOString();

  const { error: updateError } = await supabase
    .from("transport_orders")
    .update({
      locked_by_user_id: userId,
      locked_at: lockedAt,
    })
    .eq("id", orderId);

  if (updateError) throw updateError;

  // 4. Return response DTO
  return {
    id: orderId,
    lockedByUserId: userId,
    lockedAt: lockedAt,
  };
}

// ---------------------------------------------------------------------------
// POST /api/v1/orders/{orderId}/unlock — release edit lock
// ---------------------------------------------------------------------------

/**
 * Releases the edit lock on a transport order.
 *
 * Unlocking rules (idempotent):
 * - If locked by the current user → unlock.
 * - If locked by another user and current user is ADMIN → force unlock.
 * - If locked by another user and current user is NOT ADMIN → 403.
 * - If not locked at all → return 200 (idempotent, already unlocked).
 *
 * @param userRole - needed to check ADMIN override permission
 * @returns UnlockOrderResponseDto on success, or an error object on failure.
 */
export async function unlockOrder(
  supabase: SupabaseClient<Database>,
  userId: string,
  userRole: string,
  orderId: string
): Promise<UnlockOrderResponseDto | { error: string; status: number; message?: string }> {
  // 1. Fetch existing order with lock info
  const { data: existing, error: fetchError } = await supabase
    .from("transport_orders")
    .select("id, locked_by_user_id, locked_at")
    .eq("id", orderId)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      return { error: "NOT_FOUND", status: 404 };
    }
    throw fetchError;
  }

  // 2. If already unlocked — return success (idempotent)
  if (!existing.locked_by_user_id) {
    return {
      id: orderId,
      lockedByUserId: null,
      lockedAt: null,
    };
  }

  // 3. Check permission to unlock
  if (existing.locked_by_user_id !== userId && userRole !== "ADMIN") {
    return {
      error: "FORBIDDEN",
      status: 403,
      message: "Brak uprawnień do odblokowania zlecenia zablokowanego przez innego użytkownika",
    };
  }

  // 4. Release lock
  const { error: updateError } = await supabase
    .from("transport_orders")
    .update({
      locked_by_user_id: null,
      locked_at: null,
    })
    .eq("id", orderId);

  if (updateError) throw updateError;

  // 5. Return response DTO
  return {
    id: orderId,
    lockedByUserId: null,
    lockedAt: null,
  };
}

// ---------------------------------------------------------------------------
// POST /api/v1/orders/{orderId}/duplicate — copy order
// ---------------------------------------------------------------------------

/**
 * Creates a new order based on an existing one (template).
 *
 * Flow:
 * 1. Fetch the source order (+ stops and items if requested).
 * 2. Generate a new order_no.
 * 3. Insert new transport_orders row copying header fields from source.
 *    New order gets status ROB, a new id, fresh timestamps, no lock.
 * 4. If includeStops → copy all stops with new ids linked to new order.
 * 5. If includeItems → copy all items with new ids linked to new order.
 * 6. Insert initial order_status_history.
 * 7. Update denormalized fields on the new order.
 *
 * @returns DuplicateOrderResponseDto on success, or an error object on failure.
 */
export async function duplicateOrder(
  supabase: SupabaseClient<Database>,
  userId: string,
  orderId: string,
  command: DuplicateOrderInput
): Promise<DuplicateOrderResponseDto | { error: string; status: number }> {
  // 1. Fetch source order
  const { data: source, error: fetchError } = await supabase
    .from("transport_orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      return { error: "NOT_FOUND", status: 404 };
    }
    throw fetchError;
  }

  // 2. Generate new order_no
  const year = new Date().getFullYear();
  const newOrderNo = await generateOrderNo(supabase, year);

  // 3. Insert new order — copy header fields, reset operational ones
  const { data: newOrder, error: insertError } = await supabase
    .from("transport_orders")
    .insert({
      order_no: newOrderNo,
      status_code: "ROB",
      transport_type_code: source.transport_type_code,
      currency_code: source.currency_code,
      vehicle_variant_code: source.vehicle_variant_code,
      carrier_company_id: source.carrier_company_id,
      shipper_location_id: source.shipper_location_id,
      receiver_location_id: source.receiver_location_id,
      price_amount: source.price_amount,
      total_load_tons: source.total_load_tons,
      required_documents_text: source.required_documents_text,
      general_notes: source.general_notes,
      sender_contact_name: source.sender_contact_name,
      sender_contact_phone: source.sender_contact_phone,
      sender_contact_email: source.sender_contact_email,
      // Copy snapshots from source — they are still valid
      carrier_name_snapshot: source.carrier_name_snapshot,
      carrier_location_name_snapshot: source.carrier_location_name_snapshot,
      carrier_address_snapshot: source.carrier_address_snapshot,
      shipper_name_snapshot: source.shipper_name_snapshot,
      shipper_address_snapshot: source.shipper_address_snapshot,
      receiver_name_snapshot: source.receiver_name_snapshot,
      receiver_address_snapshot: source.receiver_address_snapshot,
      // Reset operational fields
      created_by_user_id: userId,
      // complaint_reason is NOT copied (new order starts clean)
    })
    .select("id, order_no, status_code, created_at")
    .single();

  if (insertError || !newOrder) {
    throw insertError ?? new Error("Failed to create duplicated order");
  }

  // 4. Copy stops if requested
  if (command.includeStops) {
    const { data: sourceStops } = await supabase
      .from("order_stops")
      .select("*")
      .eq("order_id", orderId)
      .order("sequence_no", { ascending: true });

    if (sourceStops && sourceStops.length > 0) {
      const stopsToInsert = sourceStops.map((stop) => ({
        order_id: newOrder.id,
        kind: stop.kind,
        sequence_no: stop.sequence_no,
        date_local: stop.date_local,
        time_local: stop.time_local,
        location_id: stop.location_id,
        location_name_snapshot: stop.location_name_snapshot,
        company_name_snapshot: stop.company_name_snapshot,
        address_snapshot: stop.address_snapshot,
        notes: stop.notes,
      }));

      const { error: stopsError } = await supabase
        .from("order_stops")
        .insert(stopsToInsert);

      if (stopsError) {
        // Rollback — delete new order (CASCADE removes stops)
        await supabase.from("transport_orders").delete().eq("id", newOrder.id);
        throw stopsError;
      }
    }
  }

  // 5. Copy items if requested
  if (command.includeItems) {
    const { data: sourceItems } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    if (sourceItems && sourceItems.length > 0) {
      const itemsToInsert = sourceItems.map((item) => ({
        order_id: newOrder.id,
        product_id: item.product_id,
        product_name_snapshot: item.product_name_snapshot,
        default_loading_method_snapshot: item.default_loading_method_snapshot,
        quantity_tons: item.quantity_tons,
        notes: item.notes,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(itemsToInsert);

      if (itemsError) {
        await supabase.from("transport_orders").delete().eq("id", newOrder.id);
        throw itemsError;
      }
    }
  }

  // 6. Insert initial status history
  await supabase.from("order_status_history").insert({
    order_id: newOrder.id,
    old_status_code: "ROB",
    new_status_code: "ROB",
    changed_by_user_id: userId,
  });

  // 7. Update denormalized fields on the new order
  await updateDenormalizedFields(supabase, newOrder.id);

  return {
    id: newOrder.id,
    orderNo: newOrder.order_no,
    statusCode: "ROB",
  };
}

// ---------------------------------------------------------------------------
// PATCH /api/v1/orders/{orderId}/stops/{stopId} — partial stop update
// ---------------------------------------------------------------------------

/**
 * Partially updates a single order stop.
 *
 * Flow:
 * 1. Fetch the order and verify editability (status, lock).
 * 2. Fetch the stop and verify it belongs to the order.
 * 3. If locationId changed → re-resolve snapshot data.
 * 4. Update the stop row.
 * 5. Update denormalized fields on the parent order.
 * 6. If a business field changed and status ∈ {WYS, KOR_WYS} → auto-transition to KOR.
 * 7. Return updated stop DTO.
 *
 * @returns Updated OrderDetailStopDto on success, or an error object on failure.
 */
export async function patchStop(
  supabase: SupabaseClient<Database>,
  userId: string,
  orderId: string,
  stopId: string,
  command: PatchStopInput
): Promise<PatchStopResponseDto | { error: string; status: number; message?: string }> {
  // 1. Fetch order — check existence, lock, editability
  const { data: order, error: orderError } = await supabase
    .from("transport_orders")
    .select("id, status_code, locked_by_user_id, locked_at")
    .eq("id", orderId)
    .single();

  if (orderError) {
    if (orderError.code === "PGRST116") {
      return { error: "NOT_FOUND", status: 404, message: "Zlecenie nie istnieje" };
    }
    throw orderError;
  }

  // Check lock — if locked by another user and not expired → 409
  if (order.locked_by_user_id && order.locked_by_user_id !== userId) {
    const lockTimeoutMs = LOCK_TIMEOUT_MINUTES * 60 * 1000;
    const lockedAt = new Date(order.locked_at!).getTime();
    if (Date.now() - lockedAt < lockTimeoutMs) {
      return {
        error: "LOCKED",
        status: 409,
        message: "Zlecenie jest zablokowane przez innego użytkownika",
      };
    }
  }

  // Check status editability
  const { data: statusInfo } = await supabase
    .from("order_statuses")
    .select("is_editable")
    .eq("code", order.status_code)
    .single();

  if (statusInfo && !statusInfo.is_editable) {
    return {
      error: "STATUS_NOT_EDITABLE",
      status: 403,
      message: "Status zlecenia nie pozwala na edycję",
    };
  }

  // 2. Fetch stop and verify it belongs to this order
  const { data: existingStop, error: stopError } = await supabase
    .from("order_stops")
    .select("*")
    .eq("id", stopId)
    .single();

  if (stopError) {
    if (stopError.code === "PGRST116") {
      return { error: "NOT_FOUND", status: 404, message: "Punkt trasy nie istnieje" };
    }
    throw stopError;
  }

  if (existingStop.order_id !== orderId) {
    return {
      error: "NOT_FOUND",
      status: 404,
      message: "Punkt trasy nie należy do tego zlecenia",
    };
  }

  // 3. Build update payload
  const updatePayload: Record<string, unknown> = {};

  if (command.dateLocal !== undefined) {
    updatePayload.date_local = command.dateLocal;
  }
  if (command.timeLocal !== undefined) {
    updatePayload.time_local = command.timeLocal;
  }
  if (command.notes !== undefined) {
    updatePayload.notes = command.notes;
  }

  // If locationId changed → re-resolve snapshots
  if (command.locationId !== undefined) {
    updatePayload.location_id = command.locationId;
    const snap = await resolveStopSnapshot(supabase, command.locationId);
    updatePayload.location_name_snapshot = snap.locationNameSnapshot;
    updatePayload.company_name_snapshot = snap.companyNameSnapshot;
    updatePayload.address_snapshot = snap.addressSnapshot;
  }

  // 4. Update stop row
  const { data: updatedStop, error: updateError } = await supabase
    .from("order_stops")
    .update(updatePayload)
    .eq("id", stopId)
    .select("*")
    .single();

  if (updateError) throw updateError;
  if (!updatedStop) throw new Error("Failed to update stop");

  // 5. Update denormalized fields on the parent order
  await updateDenormalizedFields(supabase, orderId);

  // 6. Auto-transition: if business fields changed and status ∈ {WYS, KOR_WYS} → KOR
  const businessFieldChanged =
    command.dateLocal !== undefined ||
    command.timeLocal !== undefined ||
    command.locationId !== undefined;

  if (
    businessFieldChanged &&
    (order.status_code === "WYS" || order.status_code === "KOR_WYS")
  ) {
    await supabase
      .from("transport_orders")
      .update({
        status_code: "KOR",
        updated_by_user_id: userId,
      })
      .eq("id", orderId);

    // Log status transition
    await supabase.from("order_status_history").insert({
      order_id: orderId,
      old_status_code: order.status_code,
      new_status_code: "KOR",
      changed_by_user_id: userId,
    });
  }

  // 7. Return updated stop as DTO
  return {
    id: updatedStop.id,
    kind: updatedStop.kind as StopKind,
    sequenceNo: updatedStop.sequence_no,
    dateLocal: updatedStop.date_local,
    timeLocal: updatedStop.time_local,
    locationId: updatedStop.location_id,
    locationNameSnapshot: updatedStop.location_name_snapshot,
    companyNameSnapshot: updatedStop.company_name_snapshot,
    addressSnapshot: updatedStop.address_snapshot,
    notes: updatedStop.notes,
  };
}

// ---------------------------------------------------------------------------
// GET /api/v1/orders/{orderId}/history/status — status history
// ---------------------------------------------------------------------------

/**
 * Returns a chronological list of status changes for a given order.
 *
 * Queries `order_status_history` with a join on `user_profiles` to resolve
 * the `changedByUserName` display name. Results are sorted ascending by
 * `changed_at` so the earliest change comes first.
 *
 * @returns Array of StatusHistoryItemDto (empty array if no history found).
 */
export async function getStatusHistory(
  supabase: SupabaseClient<Database>,
  orderId: string
): Promise<StatusHistoryItemDto[]> {
  const { data, error } = await supabase
    .from("order_status_history")
    .select(
      "id, old_status_code, new_status_code, changed_at, changed_by_user_id, user_profiles!order_status_history_changed_by_user_id_fkey(full_name)"
    )
    .eq("order_id", orderId)
    .order("changed_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => {
    // Supabase returns the joined user_profiles as a nested object
    const userInfo = row.user_profiles as unknown as {
      full_name: string | null;
    } | null;

    return {
      id: row.id,
      oldStatusCode: row.old_status_code,
      newStatusCode: row.new_status_code,
      changedAt: row.changed_at,
      changedByUserId: row.changed_by_user_id,
      changedByUserName: userInfo?.full_name ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// GET /api/v1/orders/{orderId}/history/changes — field change log
// ---------------------------------------------------------------------------

/**
 * Returns a chronological log of field-level changes for a given order.
 *
 * Queries `order_change_log` with a join on `user_profiles` to resolve
 * the `changedByUserName` display name. Results are sorted ascending by
 * `changed_at` so the earliest change comes first.
 *
 * @returns Array of ChangeLogItemDto (empty array if no changes found).
 */
export async function getChangeLog(
  supabase: SupabaseClient<Database>,
  orderId: string
): Promise<ChangeLogItemDto[]> {
  const { data, error } = await supabase
    .from("order_change_log")
    .select(
      "id, field_name, old_value, new_value, changed_at, changed_by_user_id, user_profiles!order_change_log_changed_by_user_id_fkey(full_name)"
    )
    .eq("order_id", orderId)
    .order("changed_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const userInfo = row.user_profiles as unknown as {
      full_name: string | null;
    } | null;

    return {
      id: row.id,
      fieldName: row.field_name,
      oldValue: row.old_value,
      newValue: row.new_value,
      changedAt: row.changed_at,
      changedByUserId: row.changed_by_user_id,
      changedByUserName: userInfo?.full_name ?? null,
    };
  });
}
