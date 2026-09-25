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

import {
  errorResponse,
  getAuthenticatedUser,
  logError,
  requireWriteAccess,
} from "@/lib/api-helpers";
import { deleteTokens } from "@/lib/services/ms-graph.service";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const POST: APIRoute = async ({ locals }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  const writeErr = requireWriteAccess(authResult);
  if (writeErr) return writeErr;

  try {
    const admin = createAdminSupabaseClient();
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
