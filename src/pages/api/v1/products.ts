/**
 * GET /api/v1/products — lista produktów (słownik, autocomplete).
 * Query: search (opcjonalny).
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  parseQueryParams,
} from "../../../lib/api-helpers";
import { getProducts } from "../../../lib/services/dictionary.service";

export const GET: APIRoute = async ({ locals, request }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  try {
    const url = new URL(request.url);
    const params = parseQueryParams(url);
    const search = typeof params.search === "string" ? params.search : undefined;
    const result = await getProducts(locals.supabase, search);
    return jsonResponse(result, 200);
  } catch (err) {
    console.error("[GET /api/v1/products]", err);
    return errorResponse(500, "Internal Server Error", "Błąd pobierania listy produktów.");
  }
};
