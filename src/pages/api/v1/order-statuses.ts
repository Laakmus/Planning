import type { APIRoute } from "astro";
import type { ListResponse, OrderStatusDto } from "../../../types";
import { requireAuth } from "../../../lib/utils/auth-guard";
import { jsonResponse, errorResponse } from "../../../lib/utils/api-response";
import { listOrderStatuses } from "../../../lib/services/dictionary.service";

/**
 * GET /api/v1/order-statuses
 *
 * Returns list of order statuses sorted by sort_order.
 * No additional query params — always returns all statuses.
 */
export const GET: APIRoute = async ({ locals }) => {
  try {
    const authResult = await requireAuth(locals.supabase);
    if (authResult instanceof Response) return authResult;

    const items = await listOrderStatuses(authResult.supabase);

    const response: ListResponse<OrderStatusDto> = { items };
    return jsonResponse(response);
  } catch {
    return errorResponse("INTERNAL_ERROR", "Błąd serwera", 500);
  }
};
