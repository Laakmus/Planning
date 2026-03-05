/**
 * Serwis szczegółów zlecenia — getOrderDetail.
 * Wyekstrahowany z order.service.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types";
import type { OrderDetailResponseDto } from "../../types";

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
  notification_details?: string | null;
  confidentiality_clause?: string | null;
};

/** Wiersz transport_orders z JOINami z getOrderDetail() */
type DetailRowWithJoins = TransportOrderRowExtended & {
  order_statuses: { name: string } | null;
  sent_by: { full_name: string | null } | null;
  created_by: { full_name: string | null } | null;
  updated_by: { full_name: string | null } | null;
  locked_by: { full_name: string | null } | null;
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

  const row = orderRow as DetailRowWithJoins;

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
    notificationDetails: row.notification_details ?? null,
    confidentialityClause: row.confidentiality_clause ?? null,
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
    statusName: row.order_statuses?.name ?? row.status_code,
    weekNumber: row.week_number ?? null,
    sentAt: row.sent_at ?? null,
    sentByUserName: row.sent_by?.full_name ?? null,
    createdByUserName: row.created_by?.full_name ?? null,
    updatedByUserName: row.updated_by?.full_name ?? null,
    lockedByUserName: row.locked_by?.full_name ?? null,
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
