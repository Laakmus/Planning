/**
 * Serwis zmiany statusów zleceń — anulowanie, przywracanie, ręczna zmiana statusu.
 * cancelOrder: DELETE /api/v1/orders/{orderId}
 * changeStatus: POST /api/v1/orders/{orderId}/status
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types";
import type { ChangeStatusResponseDto, DeleteOrderResponseDto, RestoreOrderResponseDto } from "../../types";
import type { ChangeStatusParams } from "../validators/order.validator";

/** Status „zrealizowane" — z niego nie można anulować (kod z order_statuses.code). */
const STATUS_ZREALIZOWANE = "zrealizowane";

/** Status „anulowane" ustawiany przy DELETE (kod z order_statuses.code). */
const STATUS_ANULOWANE = "anulowane";

/** Dozwolone przejścia: newStatusCode → zestaw dozwolonych statusów bieżących. */
const ALLOWED_TRANSITIONS: Record<string, Set<string>> = {
  zrealizowane: new Set(["robocze", "wysłane", "korekta", "korekta wysłane", "reklamacja"]),
  reklamacja: new Set(["wysłane", "korekta wysłane"]),
  anulowane: new Set(["robocze", "wysłane", "korekta", "korekta wysłane", "reklamacja"]),
};

/**
 * Anuluje zlecenie (ustawienie statusu na anulowane).
 * Dozwolone przejście: z robocze, wysłane, korekta, korekta wysłane, reklamacja.
 * Niedozwolone: z zrealizowane.
 *
 * @param supabase — klient Supabase
 * @param userId — id użytkownika (do wpisu w order_status_history)
 * @param orderId — UUID zlecenia
 * @returns DeleteOrderResponseDto lub null gdy zlecenie nie istnieje; rzuca przy niedozwolonym przejściu
 */
export async function cancelOrder(
  supabase: SupabaseClient<Database>,
  userId: string,
  orderId: string
): Promise<DeleteOrderResponseDto | null> {
  const { data: order, error: fetchError } = await supabase
    .from("transport_orders")
    .select("id, status_code")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!order) return null;

  if (order.status_code === STATUS_ZREALIZOWANE || order.status_code === STATUS_ANULOWANE) {
    throw new Error("FORBIDDEN_TRANSITION");
  }

  const { error: updateError } = await supabase
    .from("transport_orders")
    .update({ status_code: STATUS_ANULOWANE })
    .eq("id", orderId);

  if (updateError) throw updateError;

  const { error: historyError } = await supabase
    .from("order_status_history")
    .insert({
      order_id: orderId,
      old_status_code: order.status_code,
      new_status_code: STATUS_ANULOWANE,
      changed_by_user_id: userId,
    });

  if (historyError) throw historyError;

  return { id: orderId, statusCode: STATUS_ANULOWANE };
}

/**
 * Ręczna zmiana statusu zlecenia (zrealizowane, reklamacja, anulowane).
 * Walidacja przejść wg ALLOWED_TRANSITIONS. Dla reklamacja wymagane complaintReason (walidacja Zod w endpointzie).
 *
 * @param supabase — klient Supabase
 * @param userId — id użytkownika
 * @param orderId — UUID zlecenia
 * @param params — newStatusCode, complaintReason (wymagane przy reklamacja)
 * @returns ChangeStatusResponseDto lub null gdy zlecenie nie istnieje; rzuca przy niedozwolonym przejściu
 */
export async function changeStatus(
  supabase: SupabaseClient<Database>,
  userId: string,
  orderId: string,
  params: ChangeStatusParams
): Promise<ChangeStatusResponseDto | null> {
  const { data: order, error: fetchError } = await supabase
    .from("transport_orders")
    .select("id, status_code")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!order) return null;

  const allowed = ALLOWED_TRANSITIONS[params.newStatusCode];
  if (!allowed || !allowed.has(order.status_code)) {
    throw new Error("FORBIDDEN_TRANSITION");
  }

  const updatePayload: { status_code: string; complaint_reason?: string | null } = {
    status_code: params.newStatusCode,
  };
  if (params.newStatusCode === "reklamacja" && params.complaintReason != null) {
    updatePayload.complaint_reason = params.complaintReason.trim();
  }

  const { error: updateError } = await supabase
    .from("transport_orders")
    .update(updatePayload)
    .eq("id", orderId);

  if (updateError) throw updateError;

  const { error: historyError } = await supabase.from("order_status_history").insert({
    order_id: orderId,
    old_status_code: order.status_code,
    new_status_code: params.newStatusCode,
    changed_by_user_id: userId,
  });

  if (historyError) throw historyError;

  const { error: logError } = await supabase.from("order_change_log").insert({
    order_id: orderId,
    field_name: "status_code",
    old_value: order.status_code,
    new_value: params.newStatusCode,
    changed_by_user_id: userId,
  });

  if (logError) throw logError;

  return {
    id: orderId,
    oldStatusCode: order.status_code,
    newStatusCode: params.newStatusCode,
  };
}

/** Status „korekta" — docelowy przy przywracaniu. */
const STATUS_KOREKTA = "korekta";

/** Czas w ms, po którym anulowane nie może być przywrócone (24h). */
const RESTORE_ANULOWANE_MAX_MS = 24 * 60 * 60 * 1000;

/**
 * Przywraca zlecenie z zrealizowane/anulowane do aktualnych (status = korekta).
 * Z anulowane tylko jeśli minęło < 24h od anulowania (w przeciwnym razie 410 Gone).
 *
 * @param supabase — klient Supabase
 * @param userId — id użytkownika
 * @param orderId — UUID zlecenia
 */
export async function restoreOrder(
  supabase: SupabaseClient<Database>,
  userId: string,
  orderId: string
): Promise<RestoreOrderResponseDto | null> {
  const { data: order, error: fetchError } = await supabase
    .from("transport_orders")
    .select("id, status_code")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!order) return null;

  const allowed = new Set(["zrealizowane", "anulowane"]);
  if (!allowed.has(order.status_code)) {
    throw new Error("FORBIDDEN_RESTORE");
  }

  if (order.status_code === "anulowane") {
    const { data: lastCancel } = await supabase
      .from("order_status_history")
      .select("changed_at")
      .eq("order_id", orderId)
      .eq("new_status_code", "anulowane")
      .order("changed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastCancel?.changed_at) {
      const cancelledAt = new Date(lastCancel.changed_at).getTime();
      if (Date.now() - cancelledAt > RESTORE_ANULOWANE_MAX_MS) {
        throw new Error("GONE_24H");
      }
    }
  }

  const { error: updateError } = await supabase
    .from("transport_orders")
    .update({ status_code: STATUS_KOREKTA })
    .eq("id", orderId);

  if (updateError) throw updateError;

  const { error: historyError } = await supabase.from("order_status_history").insert({
    order_id: orderId,
    old_status_code: order.status_code,
    new_status_code: STATUS_KOREKTA,
    changed_by_user_id: userId,
  });

  if (historyError) throw historyError;

  return { id: orderId, statusCode: STATUS_KOREKTA };
}
