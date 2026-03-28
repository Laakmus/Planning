/**
 * Serwis tworzenia zlecenia — createOrder.
 * Wyekstrahowany z order.service.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types";
import type { CreateOrderResponseDto } from "../../types";
import type { CreateOrderParams } from "../validators/order.validator";

import {
  autoSetDocumentsAndCurrency,
  batchBuildSnapshotsForItems,
  batchBuildSnapshotsForLocations,
  buildSearchText,
  buildSnapshotsForCarrier,
  computeDenormalizedFields,
  generateOrderNo,
  MAX_LOADING_STOPS,
  MAX_UNLOADING_STOPS,
  STATUS_ROBOCZE,
  validateForeignKeys,
} from "./order-snapshot.service";

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

  // 5. Auto-derive shipper/receiver z pierwszego LOADING i ostatniego UNLOADING stop
  const firstLoadingStop = stopsWithSnapshots.find((s) => s.kind === "LOADING");
  const lastUnloadingStop = [...stopsWithSnapshots].reverse().find((s) => s.kind === "UNLOADING");
  const derivedShipperLocationId = firstLoadingStop?.locationId ?? null;
  const derivedReceiverLocationId = lastUnloadingStop?.locationId ?? null;

  // Shipper/receiver snapshoty z locationSnapMap (batch-pobrana) — bez dodatkowych DB queries
  const shipperLocSnap = derivedShipperLocationId ? locationSnapMap.get(derivedShipperLocationId) ?? null : null;
  const shipperSnapshots = {
    nameSnapshot: shipperLocSnap?.companyNameSnapshot ?? null,
    addressSnapshot: shipperLocSnap?.addressSnapshot ?? null,
  };
  const receiverLocSnap = derivedReceiverLocationId ? locationSnapMap.get(derivedReceiverLocationId) ?? null : null;
  const receiverSnapshots = {
    nameSnapshot: receiverLocSnap?.companyNameSnapshot ?? null,
    addressSnapshot: receiverLocSnap?.addressSnapshot ?? null,
  };

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
    shipper_location_id: derivedShipperLocationId,
    shipper_name_snapshot: shipperSnapshots.nameSnapshot,
    shipper_address_snapshot: shipperSnapshots.addressSnapshot,
    receiver_location_id: derivedReceiverLocationId,
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
    notification_details: params.notificationDetails ?? null,
    confidentiality_clause: params.confidentialityClause ?? null,
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
