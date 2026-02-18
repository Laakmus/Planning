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
 * Sprawdza, czy blokada wygasła (starsza niż LOCK_EXPIRY_MINUTES).
 */
function isLockExpired(lockedAt: string | null): boolean {
  if (!lockedAt) return true;
  const at = new Date(lockedAt).getTime();
  return Date.now() - at > LOCK_EXPIRY_MINUTES * 60 * 1000;
}

/**
 * Ustawia blokadę edycji zlecenia dla bieżącego użytkownika.
 * Zwraca 409 jeśli zablokowane przez innego użytkownika i blokada nie wygasła.
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
  // 1. Sprawdź czy zlecenie istnieje
  const { data: order, error: fetchError } = await supabase
    .from("transport_orders")
    .select("id")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!order) return null;

  // 2. Atomowe przejęcie blokady — UPDATE z warunkami w WHERE
  const now = new Date().toISOString();
  const expiryThreshold = new Date(Date.now() - LOCK_EXPIRY_MINUTES * 60 * 1000).toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("transport_orders")
    .update({ locked_by_user_id: userId, locked_at: now })
    .eq("id", orderId)
    .or(`locked_by_user_id.is.null,locked_by_user_id.eq.${userId},locked_at.lt.${expiryThreshold}`)
    .select("id")
    .maybeSingle();

  if (updateError) throw updateError;
  if (!updated) {
    throw new Error("LOCK_CONFLICT");
  }

  return { id: orderId, lockedByUserId: userId, lockedAt: now };
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

  const { error: updateError } = await supabase
    .from("transport_orders")
    .update({ locked_by_user_id: null, locked_at: null })
    .eq("id", orderId);

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
