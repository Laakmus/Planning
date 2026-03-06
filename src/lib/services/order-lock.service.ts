/**
 * Serwis blokady edycji zleceń.
 * lockOrder: POST /api/v1/orders/{orderId}/lock
 * unlockOrder: POST /api/v1/orders/{orderId}/unlock
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../db/database.types";
import type { LockOrderResponseDto, UnlockOrderResponseDto } from "../../types";

/** Czas wygasania blokady w minutach (konfigurowalny przez env). */
const LOCK_EXPIRY_MINUTES = parseInt(import.meta.env?.LOCK_EXPIRY_MINUTES ?? "15", 10);

/**
 * Ustawia blokadę edycji zlecenia dla bieżącego użytkownika.
 * Zwraca 409 jeśli zablokowane przez innego użytkownika i blokada nie wygasła.
 *
 * Używa atomowej funkcji RPC (try_lock_order) w PostgreSQL, która wykonuje
 * UPDATE ... WHERE z warunkami blokady w jednej operacji — eliminuje race condition
 * między sprawdzeniem stanu a ustawieniem blokady.
 *
 * @param supabase — klient Supabase
 * @param userId — id użytkownika
 * @param orderId — UUID zlecenia
 */
export async function lockOrder(
  supabase: SupabaseClient<Database>,
  userId: string,
  orderId: string
): Promise<LockOrderResponseDto | null> {
  // Sprawdzenie statusu — nie pozwalamy blokować zleceń anulowanych/zrealizowanych
  const { data: orderStatus, error: statusError } = await supabase
    .from("transport_orders")
    .select("status_code")
    .eq("id", orderId)
    .maybeSingle();

  if (statusError) throw statusError;
  if (!orderStatus) return null;

  if (orderStatus.status_code === "anulowane" || orderStatus.status_code === "zrealizowane") {
    throw new Error("LOCK_TERMINAL_STATUS");
  }

  // Cast needed: generated Supabase types don't include custom RPC functions.
  // RPC zdefiniowane w supabase/migrations/20260207000000_consolidated_schema.sql (sekcja 7.1).
  type TryLockResult = {
    status: string;
    lockedByUserId?: string;
    lockedByUserName?: string;
    lockedAt?: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("try_lock_order", {
    p_order_id: orderId,
    p_user_id: userId,
    p_lock_expiry_minutes: LOCK_EXPIRY_MINUTES,
  });

  if (error) throw error;
  if (!data) throw new Error("Unexpected null from try_lock_order RPC");

  const result = data as unknown as TryLockResult;

  if (result.status === "NOT_FOUND") {
    return null;
  }

  if (result.status === "CONFLICT") {
    const err = new Error("LOCK_CONFLICT");
    (err as Error & { lockedByUserName?: string }).lockedByUserName =
      result.lockedByUserName ?? undefined;
    throw err;
  }

  return {
    id: orderId,
    lockedByUserId: result.lockedByUserId ?? userId,
    lockedAt: result.lockedAt ?? new Date().toISOString(),
  };
}

/**
 * Zwalnia blokadę. Tylko właściciel blokady lub ADMIN może odblokować.
 *
 * @param supabase — klient Supabase
 * @param userId — id użytkownika (musi być właścicielem blokady lub ADMIN)
 * @param orderId — UUID zlecenia
 * @param isAdmin — czy użytkownik ma rolę ADMIN (może odblokować cudzą blokadę)
 */
export async function unlockOrder(
  supabase: SupabaseClient<Database>,
  userId: string,
  orderId: string,
  isAdmin: boolean
): Promise<UnlockOrderResponseDto | null> {
  const { data: order, error: fetchError } = await supabase
    .from("transport_orders")
    .select("id, locked_by_user_id")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!order) return null;

  if (
    order.locked_by_user_id != null &&
    order.locked_by_user_id !== userId &&
    !isAdmin
  ) {
    throw new Error("FORBIDDEN_UNLOCK");
  }

  // Zwykły użytkownik — unlock tylko swojej blokady; admin — dowolnej.
  // Warunek WHERE zabezpiecza przed TOCTOU: między SELECT a UPDATE
  // inny użytkownik mógłby przejąć blokadę.
  let updateQuery = supabase
    .from("transport_orders")
    .update({ locked_by_user_id: null, locked_at: null })
    .eq("id", orderId);

  if (!isAdmin) {
    updateQuery = updateQuery.eq("locked_by_user_id", userId);
  }

  const { error: updateError } = await updateQuery;

  if (updateError) throw updateError;

  return { id: orderId, lockedByUserId: null, lockedAt: null };
}

/**
 * Czyści wygasłe blokady (starsze niż LOCK_EXPIRY_MINUTES).
 * Zwraca liczbę wyczyszczonych blokad.
 *
 * @param supabase — klient Supabase
 */
export async function cleanupExpiredLocks(
  supabase: SupabaseClient<Database>
): Promise<number> {
  const threshold = new Date(Date.now() - LOCK_EXPIRY_MINUTES * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("transport_orders")
    .update({ locked_by_user_id: null, locked_at: null })
    .not("locked_by_user_id", "is", null)
    .lt("locked_at", threshold)
    .select("id");

  if (error) throw error;
  return data?.length ?? 0;
}
