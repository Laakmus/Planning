/**
 * GET /api/v1/auth/me
 *
 * Zwraca profil zalogowanego użytkownika (id, email, fullName, phone, role).
 * Wymaga ważnej sesji Supabase Auth i rekordu w user_profiles.
 *
 * Odpowiedź: 200 + AuthMeDto
 * Błędy: 401 — brak sesji lub nieważny token
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
} from "../../../../lib/api-helpers";

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.supabase) {
    return errorResponse(
      500,
      "Internal Server Error",
      "Konfiguracja serwera: brak klienta Supabase."
    );
  }

  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) {
    return authResult;
  }

  return jsonResponse(authResult, 200);
};
