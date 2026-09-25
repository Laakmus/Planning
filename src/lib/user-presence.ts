/**
 * Throttled aktualizacja `user_profiles.last_seen_at` — wywoływana przez middleware
 * na każdym uwierzytelnionym requeście. Cel: widok "online/offline" w panelu admina.
 *
 * Charakterystyka:
 *  - Throttle 60s per user (in-memory Map) — fizyczny UPDATE max raz/minutę
 *  - Fire-and-forget — nie blokuje requestu, błędy SQL ignorujemy (non-critical)
 *  - Service role client — niezależne od RLS użytkownika
 *  - Cleanup interval — usuwamy wpisy >10 min temu z mapy, by nie rosła w nieskończoność
 */

import { logError } from "@/lib/api-helpers";
import { tryCreateAdminSupabaseClient } from "@/lib/supabase-admin";

/** Throttle window — minimalny odstęp między UPDATE per user (ms). */
const THROTTLE_MS = 60_000;

/** Po jakim czasie usuwamy wpis z mapy (cleanup). */
const CLEANUP_MS = 10 * 60_000;

/** userId → timestamp ostatniej fizycznej aktualizacji DB. */
const lastUpdateAt = new Map<string, number>();

/** Interval cleanup mapy — uruchamiany przy pierwszym wywołaniu helpera. */
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanupIfNeeded(): void {
  if (cleanupTimer !== null) return;
  cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - CLEANUP_MS;
    for (const [userId, ts] of lastUpdateAt.entries()) {
      if (ts < cutoff) lastUpdateAt.delete(userId);
    }
  }, CLEANUP_MS);
  // Nie blokuj zakończenia procesu Node
  cleanupTimer.unref?.();
}

/**
 * Aktualizuje `last_seen_at` dla danego usera, jeśli minęło >60s od ostatniego UPDATE.
 * Wywołuj fire-and-forget z middleware — nie await.
 */
export function maybeUpdateLastSeen(userId: string): void {
  if (!userId) return;
  startCleanupIfNeeded();

  const now = Date.now();
  const last = lastUpdateAt.get(userId) ?? 0;
  if (now - last < THROTTLE_MS) return;

  // Zaznacz że robimy update (od razu) — chroni przed równoczesnymi requestami
  lastUpdateAt.set(userId, now);

  const supabase = tryCreateAdminSupabaseClient();
  if (!supabase) return; // nie skonfigurowane (np. testy)

  void supabase
    .from("user_profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", userId)
    .then(({ error }) => {
      if (error) {
        // Non-critical — loguj ale nie blokuj requestu
        logError("[user-presence] update last_seen_at", error);
      }
    });
}

/** Tylko do testów — czyści mapę throttlingu. */
export function __resetPresenceCache(): void {
  lastUpdateAt.clear();
}
