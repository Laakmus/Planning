/**
 * Atomowe zapisy zleceń przez RPC (jedna transakcja PostgreSQL).
 *
 * Serwisy liczą snapshoty, denormalizację i audit log; tu jest tylko wywołanie RPC:
 * - `apply_order_changes` — edycja (updateOrder, patchStop),
 * - `create_order_with_children` — utworzenie (createOrder, duplicateOrder).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/db/database.types";

/** Wpis audit logu (order_id i changed_by_user_id ustawia RPC). */
export interface ChangeLogEntry {
  field_name: string;
  old_value: string | null;
  new_value: string | null;
}

/** Plan zapisu przekazywany do RPC apply_order_changes. */
export interface OrderChangesPlan {
  orderId: string;
  /** Status odczytany przed edycją — RPC zwraca CONFLICT, jeśli ktoś go zmienił. */
  expectedStatus: string;
  orderPatch: Record<string, unknown>;
  stopDeleteIds?: string[];
  /** Wiersze order_stops; z `id` = UPDATE tylko podanych kolumn, bez `id` = INSERT. */
  stops?: Array<Record<string, unknown>>;
  itemDeleteIds?: string[];
  items?: Array<Record<string, unknown>>;
  changeLog?: ChangeLogEntry[];
  statusHistory?: { old_status_code: string; new_status_code: string } | null;
  /**
   * Pomiń sprawdzenie blokady edycji — tylko dla zmian statusu, które celowo działają
   * niezależnie od blokady (anulowanie, zmiana statusu, przywrócenie, wysyłka maila).
   */
  ignoreLock?: boolean;
  /** Komunikat błędu rzucanego przy CONFLICT (domyślnie "LOCKED"). */
  conflictError?: string;
}

/**
 * Zapisuje zmiany zlecenia jednym wywołaniem RPC `apply_order_changes` (jedna transakcja).
 *
 * @throws Error(plan.conflictError ?? "LOCKED") — blokada innego użytkownika lub status zmieniony równolegle
 */
export async function applyOrderChanges(
  supabase: SupabaseClient<Database>,
  plan: OrderChangesPlan
): Promise<{ updatedAt: string }> {
  const { data, error } = await supabase.rpc("apply_order_changes", {
    p_order_id: plan.orderId,
    p_expected_status: plan.expectedStatus,
    p_order: plan.orderPatch as Json,
    p_stop_delete_ids: plan.stopDeleteIds ?? [],
    p_stops: (plan.stops ?? []) as Json,
    p_item_delete_ids: plan.itemDeleteIds ?? [],
    p_items: (plan.items ?? []) as Json,
    p_change_log: (plan.changeLog ?? []) as unknown as Json,
    p_status_history: (plan.statusHistory ?? null) as Json,
    p_ignore_lock: plan.ignoreLock ?? false,
  });

  if (error) throw error;
  const result = data as { status?: string; updated_at?: string } | null;
  if (result?.status !== "OK") {
    throw new Error(plan.conflictError ?? "LOCKED");
  }
  return { updatedAt: result.updated_at ?? new Date().toISOString() };
}

/** Dane nowego zlecenia przekazywane do RPC create_order_with_children. */
export interface NewOrderPlan {
  /** Kolumny transport_orders (bez id; created_by_user_id ustawia RPC). */
  order: Record<string, unknown>;
  stops?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  changeLog?: ChangeLogEntry[];
  statusHistory?: { old_status_code: string; new_status_code: string } | null;
}

/**
 * Tworzy zlecenie ze stopami, towarami, historią i logiem w jednej transakcji.
 * Błąd w dowolnym kroku = brak zlecenia (bez osieroconych rekordów).
 */
export async function createOrderWithChildren(
  supabase: SupabaseClient<Database>,
  plan: NewOrderPlan
): Promise<{ id: string; createdAt: string }> {
  const { data, error } = await supabase.rpc("create_order_with_children", {
    p_order: plan.order as Json,
    p_stops: (plan.stops ?? []) as Json,
    p_items: (plan.items ?? []) as Json,
    p_change_log: (plan.changeLog ?? []) as unknown as Json,
    p_status_history: (plan.statusHistory ?? null) as Json,
  });

  if (error) throw error;
  const result = data as { id?: string; created_at?: string } | null;
  if (!result?.id) throw new Error("Insert order failed");
  return { id: result.id, createdAt: result.created_at ?? new Date().toISOString() };
}
