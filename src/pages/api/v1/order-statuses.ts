/**
 * GET /api/v1/order-statuses — lista statusów zleceń.
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  logError,
} from "../../../lib/api-helpers";
import { getOrderStatuses } from "../../../lib/services/dictionary.service";

export const GET: APIRoute = async ({ locals }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  try {
    const result = await getOrderStatuses(locals.supabase);
    return jsonResponse(result, 200, { "Cache-Control": "public, max-age=3600" });
  } catch (err) {
    logError("[GET /api/v1/order-statuses]", err);
    return errorResponse(500, "Internal Server Error", "Błąd pobierania statusów zleceń.");
  }
};
