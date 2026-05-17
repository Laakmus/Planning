/**
 * POST /api/v1/ms-oauth/disconnect
 *
 * Usuwa rekord tokenów MS Graph dla zalogowanego usera (DELETE z `ms_oauth_tokens`).
 * Operacja idempotentna — gdy brak rekordu, też zwraca 204 (no-op).
 *
 * Uprawnienia: ADMIN lub PLANNER (READ_ONLY nie powinien modyfikować konfiguracji email).
 *
 * Uwaga: usunięcie rekordu w DB NIE unieważnia tokenów po stronie Microsoftu (są one
 * nadal ważne aż do wygaśnięcia lub revoke przez usera w portal.microsoft.com).
 * Realne unieważnienie wymaga POST /me/revokeSignInSessions — pomijamy (opcjonalne).
 */

import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../../../../db/database.types";
import {
  errorResponse,
  getAuthenticatedUser,
  logError,
  requireWriteAccess,
} from "../../../../lib/api-helpers";
import { deleteTokens } from "../../../../lib/services/ms-graph.service";

/** Odczyt zmiennej środowiskowej. */
function getEnv(name: string): string {
  return import.meta.env[name] ?? process.env[name] ?? "";
}

/** Klient service_role — wymagany do DELETE (RLS pozwala na user_id = auth.uid(), ale używamy admin dla spójności). */
function createAdminClient() {
  const url = getEnv("SUPABASE_URL");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const POST: APIRoute = async ({ locals }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  const writeErr = requireWriteAccess(authResult);
  if (writeErr) return writeErr;

  try {
    const admin = createAdminClient();
    await deleteTokens(admin, authResult.id);
    return new Response(null, { status: 204 });
  } catch (err) {
    logError("[POST /api/v1/ms-oauth/disconnect]", err);
    return errorResponse(
      500,
      "Internal Server Error",
      "Nie udało się rozłączyć konta Microsoft."
    );
  }
};
