/**
 * Serwis zmiany statusów zleceń — anulowanie, przywracanie, ręczna zmiana statusu.
 * cancelOrder: DELETE /api/v1/orders/{orderId}
 * changeStatus: POST /api/v1/orders/{orderId}/status
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types";
import type { ChangeStatusResponseDto, DeleteOrderResponseDto, RestoreOrderResponseDto } from "@/types";
import type { ChangeStatusParams } from "@/lib/validators/order.validator";
import { isManualTransitionAllowed, ORDER_STATUS, TERMINAL_STATUSES } from "@/lib/order-status";
import { applyOrderChanges } from "@/lib/services/order-write.service";


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

  if (TERMINAL_STATUSES.has(order.status_code)) {
    throw new Error("FORBIDDEN_TRANSITION");
  }

  // Status + historia + log w jednej transakcji; guard statusu w RPC (TOCTOU).
  // Anulowanie celowo nie wymaga blokady edycji (ignoreLock).
  await applyOrderChanges(supabase, {
    orderId,
    expectedStatus: order.status_code,
    orderPatch: { status_code: ORDER_STATUS.CANCELLED },
    statusHistory: { old_status_code: order.status_code, new_status_code: ORDER_STATUS.CANCELLED },
    changeLog: [{ field_name: "status_code", old_value: order.status_code, new_value: ORDER_STATUS.CANCELLED }],
    ignoreLock: true,
    conflictError: "FORBIDDEN_TRANSITION",
  });

  return { id: orderId, statusCode: ORDER_STATUS.CANCELLED };
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

  // Matryca przejść wspólna z UI (@/lib/order-status)
  if (!isManualTransitionAllowed(order.status_code, params.newStatusCode)) {
    throw new Error("FORBIDDEN_TRANSITION");
  }

  const updatePayload: { status_code: string; complaint_reason?: string | null } = {
    status_code: params.newStatusCode,
  };
  if (params.newStatusCode === ORDER_STATUS.COMPLAINT && params.complaintReason != null) {
    updatePayload.complaint_reason = params.complaintReason.trim();
  } else if (params.newStatusCode !== ORDER_STATUS.COMPLAINT) {
    // M-01: Czyść complaint_reason przy wyjściu ze statusu reklamacja — pole nie jest już aktualne
    updatePayload.complaint_reason = null;
  }

  // Status + historia + log w jednej transakcji; guard statusu w RPC (TOCTOU).
  await applyOrderChanges(supabase, {
    orderId,
    expectedStatus: order.status_code,
    orderPatch: updatePayload,
    statusHistory: { old_status_code: order.status_code, new_status_code: params.newStatusCode },
    changeLog: [{ field_name: "status_code", old_value: order.status_code, new_value: params.newStatusCode }],
    ignoreLock: true,
    conflictError: "FORBIDDEN_TRANSITION",
  });

  return {
    id: orderId,
    oldStatusCode: order.status_code,
    newStatusCode: params.newStatusCode,
  };
}

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

  if (!TERMINAL_STATUSES.has(order.status_code)) {
    throw new Error("FORBIDDEN_RESTORE");
  }

  if (order.status_code === ORDER_STATUS.CANCELLED) {
    const { data: lastCancel } = await supabase
      .from("order_status_history")
      .select("changed_at")
      .eq("order_id", orderId)
      .eq("new_status_code", ORDER_STATUS.CANCELLED)
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

  // Status + historia + log w jednej transakcji; guard statusu w RPC (TOCTOU)
  await applyOrderChanges(supabase, {
    orderId,
    expectedStatus: order.status_code,
    orderPatch: { status_code: ORDER_STATUS.CORRECTION },
    statusHistory: { old_status_code: order.status_code, new_status_code: ORDER_STATUS.CORRECTION },
    changeLog: [{ field_name: "status_code", old_value: order.status_code, new_value: ORDER_STATUS.CORRECTION }],
    ignoreLock: true,
    conflictError: "FORBIDDEN_RESTORE",
  });

  return { id: orderId, statusCode: ORDER_STATUS.CORRECTION };
}
