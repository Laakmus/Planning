import type { APIRoute } from "astro";
import type { ListResponse, LocationDto } from "../../../types";
import { requireAuth } from "../../../lib/utils/auth-guard";
import { jsonResponse, errorResponse } from "../../../lib/utils/api-response";
import { locationSearchSchema } from "../../../lib/schemas/dictionary.schema";
import { listLocations } from "../../../lib/services/dictionary.service";

/**
 * GET /api/v1/locations
 *
 * Returns list of locations for autocomplete.
 * Optional query params: search, companyId (UUID), activeOnly (default true).
 */
export const GET: APIRoute = async ({ locals, url }) => {
  try {
    const authResult = await requireAuth(locals.supabase);
    if (authResult instanceof Response) return authResult;

    const parsed = locationSearchSchema.safeParse(
      Object.fromEntries(url.searchParams)
    );
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Nieprawidłowe parametry zapytania",
        400,
        parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        }))
      );
    }

    const items = await listLocations(authResult.supabase, parsed.data);

    const response: ListResponse<LocationDto> = { items };
    return jsonResponse(response);
  } catch {
    return errorResponse("INTERNAL_ERROR", "Błąd serwera", 500);
  }
};
