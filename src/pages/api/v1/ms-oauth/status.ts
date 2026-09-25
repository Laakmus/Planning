/**
 * GET /api/v1/ms-oauth/status
 *
 * Zwraca informację o stanie połączenia z kontem Microsoft Graph dla zalogowanego usera.
 *
 * Odpowiedź:
 *   `MsOAuthStatusDto`:
 *     - `connected: boolean`
 *     - `msEmail: string | null`
 *     - `expiresAt: string | null` (ISO 8601 — kiedy wygasa access_token)
 *     - `connectedAt: string | null` (ISO 8601 — kiedy user pierwszy raz połączył konto)
 *
 * Dostępne dla każdej roli (READ_ONLY też może sprawdzić swój status połączenia MS).
 */

import type { APIRoute } from "astro";

import type { MsOAuthStatusDto } from "../../../../types";
import {
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  logError,
} from "../../../../lib/api-helpers";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const GET: APIRoute = async ({ locals }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  try {
    const admin = createAdminSupabaseClient();
    // Tylko metadane — NIE wyciągamy zaszyfrowanych tokenów (oszczędność + brak potrzeby).
    const { data, error } = await admin
      .from("ms_oauth_tokens")
      .select("ms_email, expires_at, created_at")
      .eq("user_id", authResult.id)
      .maybeSingle();

    if (error) {
      logError("[GET /api/v1/ms-oauth/status]", error);
      return errorResponse(
        500,
        "Internal Server Error",
        "Nie udało się pobrać statusu połączenia z kontem Microsoft."
      );
    }

    if (!data) {
      const dto: MsOAuthStatusDto = {
        connected: false,
        msEmail: null,
        expiresAt: null,
        connectedAt: null,
      };
      return jsonResponse(dto);
    }

    const dto: MsOAuthStatusDto = {
      connected: true,
      msEmail: data.ms_email,
      expiresAt: data.expires_at,
      connectedAt: data.created_at,
    };
    return jsonResponse(dto);
  } catch (err) {
    logError("[GET /api/v1/ms-oauth/status]", err);
    return errorResponse(
      500,
      "Internal Server Error",
      "Nie udało się pobrać statusu połączenia z kontem Microsoft."
    );
  }
};
