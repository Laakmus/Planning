/**
 * GET /api/v1/companies — lista firm (słownik, autocomplete).
 * Query: search (opcjonalny) — filtrowanie po nazwie.
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  parseQueryParams,
} from "../../../lib/api-helpers";
import { getCompanies } from "../../../lib/services/dictionary.service";

export const GET: APIRoute = async ({ locals, request }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  try {
    const url = new URL(request.url);
    const params = parseQueryParams(url);
    const search = typeof params.search === "string" ? params.search : undefined;
    const result = await getCompanies(locals.supabase, search);
    return jsonResponse(result, 200);
  } catch (err) {
    console.error("[GET /api/v1/companies]", err);
    return errorResponse(500, "Internal Server Error", "Błąd pobierania listy firm.");
  }
};
