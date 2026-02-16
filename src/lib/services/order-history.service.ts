/**
 * Odczyt historii zlecenia — statusy i log zmian pól.
 * GET /api/v1/orders/{orderId}/history/status → ListResponse<StatusHistoryItemDto>
 * GET /api/v1/orders/{orderId}/history/changes → ListResponse<ChangeLogItemDto>
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types";
import type { ChangeLogItemDto, StatusHistoryItemDto } from "../../types";

/** Wiersz order_status_history z joinem user_profiles (full_name). */
type StatusHistoryRow = Database["public"]["Tables"]["order_status_history"]["Row"] & {
  changed_by_user: { full_name: string | null } | null;
};

/** Wiersz order_change_log z joinem user_profiles (full_name). */
type ChangeLogRow = Database["public"]["Tables"]["order_change_log"]["Row"] & {
  changed_by_user: { full_name: string | null } | null;
};

function mapStatusHistoryRow(row: StatusHistoryRow): StatusHistoryItemDto {
  return {
    id: row.id,
    orderId: row.order_id,
    oldStatusCode: row.old_status_code,
    newStatusCode: row.new_status_code,
    changedAt: row.changed_at,
    changedByUserId: row.changed_by_user_id,
    changedByUserName: row.changed_by_user?.full_name ?? null,
  };
}

function mapChangeLogRow(row: ChangeLogRow): ChangeLogItemDto {
  return {
    id: row.id,
    orderId: row.order_id,
    fieldName: row.field_name,
    oldValue: row.old_value,
    newValue: row.new_value,
    changedAt: row.changed_at,
    changedByUserId: row.changed_by_user_id,
    changedByUserName: row.changed_by_user?.full_name ?? null,
  };
}

/**
 * Pobiera historię zmian statusu zlecenia (order_status_history + user_profiles).
 * Zwraca null jeśli zlecenie nie istnieje.
 */
export async function getStatusHistory(
  supabase: SupabaseClient<Database>,
  orderId: string
): Promise<StatusHistoryItemDto[] | null> {
  const { data: order, error: orderErr } = await supabase
    .from("transport_orders")
    .select("id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr) throw orderErr;
  if (!order) return null;

  const { data: rows, error } = await supabase
    .from("order_status_history")
    .select(
      "id, order_id, old_status_code, new_status_code, changed_at, changed_by_user_id, changed_by_user:user_profiles!order_status_history_changed_by_user_id_fkey(full_name)"
    )
    .eq("order_id", orderId)
    .order("changed_at", { ascending: false });

  if (error) throw error;
  return (rows ?? []).map((r) => mapStatusHistoryRow(r as StatusHistoryRow));
}

/**
 * Pobiera log zmian pól zlecenia (order_change_log + user_profiles).
 * Zwraca null jeśli zlecenie nie istnieje.
 */
export async function getChangeLog(
  supabase: SupabaseClient<Database>,
  orderId: string
): Promise<ChangeLogItemDto[] | null> {
  const { data: order, error: orderErr } = await supabase
    .from("transport_orders")
    .select("id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr) throw orderErr;
  if (!order) return null;

  const { data: rows, error } = await supabase
    .from("order_change_log")
    .select(
      "id, order_id, field_name, old_value, new_value, changed_at, changed_by_user_id, changed_by_user:user_profiles!order_change_log_changed_by_user_id_fkey(full_name)"
    )
    .eq("order_id", orderId)
    .order("changed_at", { ascending: false });

  if (error) throw error;
  return (rows ?? []).map((r) => mapChangeLogRow(r as ChangeLogRow));
}
