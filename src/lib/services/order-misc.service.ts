/**
 * Serwis operacji dodatkowych — duplicateOrder, prepareEmailForOrder, updateCarrierCellColor, updateEntryFixed.
 * Wyekstrahowany z order.service.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types";
import type { DuplicateOrderResponseDto, OrderDetailResponseDto } from "../../types";
import type { DuplicateOrderParams, PrepareEmailParams } from "../validators/order.validator";

import { getOrderDetail } from "./order-detail.service";
import { buildEmlWithPdfAttachment } from "./eml/eml-builder.service";
import {
  buildSearchText,
  generateOrderNo,
  STATUS_ROBOCZE,
  validateForeignKeys,
} from "./order-snapshot.service";
import { resolvePdfData } from "./pdf/pdf-data-resolver";
import { generateOrderPdf } from "./pdf/pdf-generator.service";

export type PrepareEmailResult =
  | { success: true; format: "eml"; emlContent: string; orderNo: string }
  | { success: true; format: "pdf-base64"; pdfBase64: string; pdfFileName: string; orderNo: string; emailSubject: string }
  | { success: false; validationErrors: string[] }
  | null;

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
    notification_details: null, // PRD §3.1.5a: "Nie kopiowane" przy duplikowaniu
    confidentiality_clause: detail.order.confidentialityClause ?? null,
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

/** Statusy dozwolone do „przygotuj email" (wysłanie). */
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

/** Buduje temat emaila: {orderNo} -{odbiorcy} - {carrier} - {załadunki} - zał. {DD/MM/YYYY} */
function buildEmailSubject(detail: OrderDetailResponseDto): string {
  const { order, stops } = detail;

  const orderNo = order.orderNo || "???";

  // Odbiorcy = unikalne companyNameSnapshot z UNLOADING stops
  const receivers = [...new Set(
    stops
      .filter(s => s.kind === "UNLOADING" && s.companyNameSnapshot?.trim())
      .map(s => s.companyNameSnapshot!.trim())
  )];

  const carrier = order.carrierNameSnapshot?.trim() || "";

  // Załadunki = unikalne locationNameSnapshot z LOADING stops
  const loadings = [...new Set(
    stops
      .filter(s => s.kind === "LOADING" && s.locationNameSnapshot?.trim())
      .map(s => s.locationNameSnapshot!.trim())
  )];

  // Data pierwszego załadunku DD/MM/YYYY
  let dateStr = "";
  if (order.firstLoadingDate) {
    const d = order.firstLoadingDate.slice(0, 10); // YYYY-MM-DD
    const [y, m, day] = d.split("-");
    dateStr = `${day}/${m}/${y}`;
  }

  // Składanie: pomijamy puste segmenty
  const parts: string[] = [orderNo];
  if (receivers.length > 0) parts.push(`-${receivers.join("+")}`);
  if (carrier) parts.push(carrier);
  if (loadings.length > 0) parts.push(loadings.join("+"));
  if (dateStr) parts.push(`zał. ${dateStr}`);

  return parts.join(" - ");
}

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

  // Generowanie PDF
  const pdfInput = await resolvePdfData(supabase, detail);
  const pdfBuffer = generateOrderPdf(pdfInput);
  // Allowlist: tylko bezpieczne znaki w nazwie pliku (alfanumeryczne, kropka, myślnik, podkreślnik)
  const sanitizedName = (order.orderNo || orderId).replace(/[^a-zA-Z0-9._-]/g, "-");
  const pdfFileName = `zlecenie-${sanitizedName}.pdf`;

  // Format pdf-base64: zwróć PDF jako base64 (do Graph API na frontendzie)
  if (_params.outputFormat === "pdf-base64") {
    // pdfBuffer to ArrayBuffer z jsPDF — konwertujemy na base64
    const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");
    return {
      success: true,
      format: "pdf-base64" as const,
      pdfBase64,
      pdfFileName,
      orderNo: order.orderNo,
      emailSubject: buildEmailSubject(detail),
    };
  }

  // Format eml: buduj plik .eml z załącznikiem PDF
  // Temat identyczny z Graph API flow (graph-mail.ts)
  const emlSubject = buildEmailSubject(detail);
  const emlContent = buildEmlWithPdfAttachment({ pdfBuffer, pdfFileName, subject: emlSubject });

  return {
    success: true,
    format: "eml" as const,
    emlContent,
    orderNo: order.orderNo,
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
    const { error: logErr } = await supabase.from("order_change_log").insert({
      order_id: orderId,
      changed_by_user_id: userId,
      field_name: "is_entry_fixed",
      old_value: formatValue(oldValue),
      new_value: formatValue(isEntryFixed),
    });
    if (logErr) throw logErr;
  }

  return { id: orderId, isEntryFixed };
}
