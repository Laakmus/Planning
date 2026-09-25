/**
 * POST /api/v1/auth/logout
 *
 * Endpoint wylogowania — zeruje `last_seen_at` aby user natychmiast pokazywał
 * się jako "offline" w panelu admina (zamiast wisieć "online" przez 5 minut
 * aż minie próg presence).
 *
 * Charakterystyka:
 *  - Wymaga uwierzytelnienia (Bearer JWT)
 *  - Idempotentne — można wywołać wielokrotnie
 *  - Wspiera `navigator.sendBeacon` — frontend może wysyłać przy `beforeunload`
 *    (zamknięcie karty). sendBeacon wysyła POST bez headerów innych niż
 *    Content-Type, więc auth musi działać z JWT w body LUB cookie. Tu używamy
 *    Authorization header — sendBeacon nie wyśle JWT, więc to jest fallback
 *    dla explicit logout (przycisk).
 *  - Service role client — zerujemy last_seen_at omijając RLS
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  logError,
} from "@/lib/api-helpers";
import { tryCreateAdminSupabaseClient } from "@/lib/supabase-admin";

export const POST: APIRoute = async ({ locals }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  const userId = authResult.id;

  try {
    // Service role — omija RLS, gwarantuje UPDATE niezależnie od polityk
    const supabase = tryCreateAdminSupabaseClient();
    if (!supabase) {
      // Brak konfiguracji — odpowiadamy 204, frontend kontynuuje logout
      return new Response(null, { status: 204 });
    }

    // Zeruj last_seen_at — user natychmiast pokaże się jako offline
    const { error } = await supabase
      .from("user_profiles")
      .update({ last_seen_at: null })
      .eq("id", userId);

    if (error) {
      logError("[POST /api/v1/auth/logout] update last_seen_at", error);
      // Nie blokuj — frontend i tak wyloguje przez Supabase signOut
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    logError("[POST /api/v1/auth/logout]", err);
    return errorResponse(500, "Internal Server Error", "Błąd podczas wylogowania.");
  }
};
