/**
 * GET /api/v1/vehicle-variants — lista wariantów pojazdów.
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  logError,
} from "../../../lib/api-helpers";
import { getVehicleVariants } from "../../../lib/services/dictionary.service";

export const GET: APIRoute = async ({ locals }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  try {
    const result = await getVehicleVariants(locals.supabase);
    return jsonResponse(result, 200, { "Cache-Control": "public, max-age=3600" });
  } catch (err) {
    logError("[GET /api/v1/vehicle-variants]", err);
    return errorResponse(500, "Internal Server Error", "Błąd pobierania wariantów pojazdów.");
  }
};
