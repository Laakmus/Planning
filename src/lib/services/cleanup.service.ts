/**
 * Serwis czyszczenia anulowanych zleceń.
 *
 * PRD §3.1.7 / §3.1.14: zlecenia ze statusem "anulowane" są fizycznie usuwane
 * z bazy po upływie 24 godzin od momentu anulowania (ostatni wpis w order_status_history
 * z new_status_code = "anulowane").
 *
 * CASCADE na FK automatycznie usuwa powiązane: order_stops, order_items,
 * order_status_history, order_change_log.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import { logger } from "../logger";

// ---------------------------------------------------------------------------
// Stałe
// ---------------------------------------------------------------------------

/** Czas retencji anulowanych zleceń w milisekundach (24h). */
const RETENTION_MS = 24 * 60 * 60 * 1000;

/** Interwał schedulera w milisekundach (1h). */
const SCHEDULER_INTERVAL_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Service-role client (pomija RLS — cleanup działa bez sesji użytkownika)
// ---------------------------------------------------------------------------

/**
 * Tworzy klienta Supabase z kluczem service_role.
 * Wymaga zmiennych środowiskowych SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY.
 */
export function createServiceRoleClient(): SupabaseClient<Database> {
  const url = import.meta.env.SUPABASE_URL;
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY — nie można utworzyć klienta service_role."
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// Logika czyszczenia
// ---------------------------------------------------------------------------

export interface CleanupResult {
  /** Liczba usuniętych zleceń. */
  deletedCount: number;
  /** ID usuniętych zleceń (do audytu). */
  deletedOrderIds: string[];
}

/**
 * Znajduje i fizycznie usuwa zlecenia anulowane dłużej niż 24h.
 *
 * Algorytm:
 * 1. Pobierz zlecenia ze statusem "anulowane".
 * 2. Dla każdego sprawdź ostatni wpis w order_status_history
 *    z new_status_code = "anulowane" — kolumna changed_at.
 * 3. Jeśli changed_at < (now - 24h) → usuń zlecenie (CASCADE).
 *
 * @param supabase — klient Supabase (service_role, pomija RLS)
 * @param retentionMs — czas retencji w ms (domyślnie 24h, konfigurowalne dla testów)
 */
export async function cleanupCancelledOrders(
  supabase: SupabaseClient<Database>,
  retentionMs: number = RETENTION_MS
): Promise<CleanupResult> {
  // Próg czasowy — zlecenia anulowane przed tą datą kwalifikują się do usunięcia
  const cutoffDate = new Date(Date.now() - retentionMs).toISOString();

  // Krok 1: Pobierz ID zleceń "anulowane" z historią statusów
  // Szukamy ostatniego wpisu w order_status_history gdzie new_status_code = "anulowane"
  // i changed_at < cutoff
  const { data: candidates, error: fetchError } = await supabase
    .from("order_status_history")
    .select("order_id, changed_at")
    .eq("new_status_code", "anulowane")
    .lt("changed_at", cutoffDate)
    .order("changed_at", { ascending: false });

  if (fetchError) {
    throw new Error(`Błąd pobierania historii statusów: ${fetchError.message}`);
  }

  if (!candidates || candidates.length === 0) {
    logCleanup(0, []);
    return { deletedCount: 0, deletedOrderIds: [] };
  }

  // Deduplikacja — bierzemy unikalne order_id.
  // Set zachowuje insertion order (ES2015+), więc kolejność z ORDER BY jest zachowana.
  const candidateOrderIds = [...new Set(candidates.map((c) => c.order_id))];

  // Krok 2: Double-check — sprawdź że zlecenia NADAL mają status "anulowane"
  // (mogły zostać przywrócone między momentem anulowania a teraz)
  const { data: confirmedOrders, error: confirmError } = await supabase
    .from("transport_orders")
    .select("id")
    .in("id", candidateOrderIds)
    .eq("status_code", "anulowane");

  if (confirmError) {
    throw new Error(`Błąd weryfikacji statusu zleceń: ${confirmError.message}`);
  }

  if (!confirmedOrders || confirmedOrders.length === 0) {
    logCleanup(0, []);
    return { deletedCount: 0, deletedOrderIds: [] };
  }

  const idsToDelete = confirmedOrders.map((o) => o.id);

  // Krok 3: Fizyczne usunięcie (CASCADE usuwa stops, items, history, change_log)
  const { error: deleteError } = await supabase
    .from("transport_orders")
    .delete()
    .in("id", idsToDelete);

  if (deleteError) {
    throw new Error(`Błąd usuwania zleceń: ${deleteError.message}`);
  }

  logCleanup(idsToDelete.length, idsToDelete);

  return {
    deletedCount: idsToDelete.length,
    deletedOrderIds: idsToDelete,
  };
}

// ---------------------------------------------------------------------------
// Structured logging
// ---------------------------------------------------------------------------

function logCleanup(count: number, orderIds: string[]): void {
  logger.info(
    {
      context: "[cleanup] cleanupCancelledOrders",
      deletedCount: count,
      deletedOrderIds: orderIds,
    },
    `Usunięto ${count} anulowanych zleceń`
  );
}

// ---------------------------------------------------------------------------
// Scheduler (setInterval co 1h)
// ---------------------------------------------------------------------------

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Uruchamia cykliczny job czyszczący (co 1 godzinę).
 * Tworzy klienta service_role wewnętrznie.
 * Bezpieczny do wielokrotnego wywołania — nie tworzy duplikatów.
 */
export function startCleanupScheduler(): void {
  if (schedulerInterval) {
    logger.warn(
      { context: "[cleanup] startCleanupScheduler" },
      "Scheduler już działa — pomijam duplikat."
    );
    return;
  }

  logger.info(
    { context: "[cleanup] startCleanupScheduler" },
    `Scheduler uruchomiony — interwał: ${SCHEDULER_INTERVAL_MS / 1000}s`
  );

  // Pierwsze uruchomienie po 1 minucie (daj serwerowi czas na start)
  setTimeout(() => {
    void runScheduledCleanup();
  }, 60_000);

  schedulerInterval = setInterval(() => {
    void runScheduledCleanup();
  }, SCHEDULER_INTERVAL_MS);
}

/**
 * Zatrzymuje scheduler (przydatne w testach / graceful shutdown).
 */
export function stopCleanupScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info(
      { context: "[cleanup] stopCleanupScheduler" },
      "Scheduler zatrzymany."
    );
  }
}

/**
 * Pojedyncze uruchomienie schedulera — opakowuje cleanupCancelledOrders
 * z własnym klientem service_role i obsługą błędów.
 */
async function runScheduledCleanup(): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    await cleanupCancelledOrders(supabase);
  } catch (err) {
    logger.error(
      {
        context: "[cleanup] runScheduledCleanup",
        err,
      },
      err instanceof Error ? err.message : String(err)
    );
  }
}
