/**
 * Serwis aktualizacji zlecenia — updateOrder, patchStop.
 * Wyekstrahowany z order.service.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types";
import type { PatchStopResponseDto, UpdateOrderResponseDto } from "../../types";
import type { PatchStopParams, UpdateOrderParams } from "../validators/order.validator";

import {
  batchBuildSnapshotsForItems,
  batchBuildSnapshotsForLocations,
  buildSearchText,
  buildSnapshotsForCarrier,
  buildSnapshotsForLocation,
  buildSnapshotsForShipperReceiver,
  computeDenormalizedFields,
  MAX_LOADING_STOPS,
  MAX_UNLOADING_STOPS,
  validateForeignKeys,
} from "./order-snapshot.service";

/** Statusy, z których nie wolno edytować zlecenia (PUT). */
const READONLY_STATUSES = new Set(["zrealizowane", "anulowane"]);

/** Statusy powodujące automatyczne przejście na „korekta" przy edycji pól biznesowych. */
const AUTO_KOREKTA_FROM = new Set(["wysłane", "korekta wysłane"]);

const STATUS_KOREKTA = "korekta";

/**
 * Pełna aktualizacja zlecenia (nagłówek + punkty trasy + pozycje).
 * Sprawdza blokadę (409), status (400 dla zrealizowane/anulowane), limity stops (max 8 LOADING, 3 UNLOADING).
 * Automatyczne przejście na „korekta" gdy status to wysłane/korekta wysłane.
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
      general_notes, notification_details, confidentiality_clause, complaint_reason, required_documents_text,
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
        general_notes: string | null; notification_details: string | null; confidentiality_clause: string | null; complaint_reason: string | null;
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
    notification_details: params.notificationDetails ?? null,
    confidentiality_clause: params.confidentialityClause ?? null,
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
    { key: "notificationDetails", dbField: "notification_details" },
    { key: "confidentialityClause", dbField: "confidentiality_clause" },
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
