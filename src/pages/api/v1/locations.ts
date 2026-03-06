/**
 * GET /api/v1/locations — lista lokalizacji (słownik, autocomplete).
 * Query: search (opcjonalny), companyId (opcjonalny, UUID).
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  parseQueryParams,
  isValidUUID,
  logError,
} from "../../../lib/api-helpers";
import { getLocations } from "../../../lib/services/dictionary.service";

export const GET: APIRoute = async ({ locals, request }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  try {
    const url = new URL(request.url);
    const params = parseQueryParams(url);
    const search = typeof params.search === "string" ? params.search : undefined;
    const companyId =
      typeof params.companyId === "string" && isValidUUID(params.companyId)
        ? params.companyId
        : undefined;
    const result = await getLocations(locals.supabase, { search, companyId });
    return jsonResponse(result, 200, { "Cache-Control": "private, max-age=3600" });
  } catch (err) {
    logError("[GET /api/v1/locations]", err);
    return errorResponse(500, "Internal Server Error", "Błąd pobierania listy lokalizacji.");
  }
};
