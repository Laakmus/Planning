import type { APIRoute } from "astro";
import type { ListResponse, CompanyDto } from "../../../types";
import { requireAuth } from "../../../lib/utils/auth-guard";
import { jsonResponse, errorResponse } from "../../../lib/utils/api-response";
import { dictionarySearchSchema } from "../../../lib/schemas/dictionary.schema";
import { listCompanies } from "../../../lib/services/dictionary.service";

/**
 * GET /api/v1/companies
 *
 * Returns list of companies for autocomplete.
 * Optional query params: search (ILIKE on name), activeOnly (default true).
 */
export const GET: APIRoute = async ({ locals, url }) => {
  try {
    const authResult = await requireAuth(locals.supabase);
    if (authResult instanceof Response) return authResult;

    // Parse and validate query params
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

    const items = await listCompanies(authResult.supabase, parsed.data);

    const response: ListResponse<CompanyDto> = { items };
    return jsonResponse(response);
  } catch {
    return errorResponse("INTERNAL_ERROR", "Błąd serwera", 500);
  }
};
