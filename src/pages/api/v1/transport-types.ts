import type { APIRoute } from "astro";
import type { ListResponse, TransportTypeDto } from "../../../types";
import { requireAuth } from "../../../lib/utils/auth-guard";
import { jsonResponse, errorResponse } from "../../../lib/utils/api-response";
import { dictionarySearchSchema } from "../../../lib/schemas/dictionary.schema";
import { listTransportTypes } from "../../../lib/services/dictionary.service";

/**
 * GET /api/v1/transport-types
 *
 * Returns list of transport types.
 * Optional query params: activeOnly (default true).
 */
export const GET: APIRoute = async ({ locals, url }) => {
  try {
    const authResult = await requireAuth(locals.supabase);
    if (authResult instanceof Response) return authResult;

    const parsed = dictionarySearchSchema.safeParse(
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

    const items = await listTransportTypes(authResult.supabase, {
      activeOnly: parsed.data.activeOnly,
    });

    const response: ListResponse<TransportTypeDto> = { items };
    return jsonResponse(response);
  } catch {
    return errorResponse("INTERNAL_ERROR", "Błąd serwera", 500);
  }
};
