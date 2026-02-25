/**
 * GET /api/v1/transport-types — lista typów transportu.
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
} from "../../../lib/api-helpers";
import { getTransportTypes } from "../../../lib/services/dictionary.service";

export const GET: APIRoute = async ({ locals }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  try {
    const result = await getTransportTypes(locals.supabase);
    return jsonResponse(result, 200, { "Cache-Control": "public, max-age=3600" });
  } catch (err) {
    console.error("[GET /api/v1/transport-types]", err);
    return errorResponse(500, "Internal Server Error", "Błąd pobierania typów transportu.");
  }
};
