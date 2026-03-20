/**
 * GET /api/v1/warehouse/report/recipients
 * Zwraca listę odbiorców raportu dla danego oddziału.
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  isValidUUID,
  jsonResponse,
  logError,
} from "../../../../../lib/api-helpers";

export const GET: APIRoute = async ({ locals, request }) => {
  if (!locals.supabase) {
    return errorResponse(500, "Internal Server Error", "Brak klienta Supabase.");
  }

  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  const url = new URL(request.url);
  const locationId = url.searchParams.get("locationId");

  if (!locationId || !isValidUUID(locationId)) {
    return errorResponse(400, "Bad Request", "Wymagany parametr locationId (UUID).");
  }

  try {
    const { data: recipients, error } = await locals.supabase
      .from("warehouse_report_recipients")
      .select("id, email, name")
      .eq("location_id", locationId);

    if (error) {
      logError("[GET /api/v1/warehouse/report/recipients]", error);
      return errorResponse(500, "Internal Server Error", "Błąd pobierania odbiorców.");
    }

    return jsonResponse({ recipients: recipients ?? [] });
  } catch (err) {
    logError("[GET /api/v1/warehouse/report/recipients]", err);
    return errorResponse(500, "Internal Server Error", "Błąd pobierania odbiorców.");
  }
};
