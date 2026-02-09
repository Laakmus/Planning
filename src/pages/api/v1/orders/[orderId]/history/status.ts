import type { APIRoute } from "astro";
import type { ListResponse, StatusHistoryItemDto } from "../../../../../../types";
import { requireAuth } from "../../../../../../lib/utils/auth-guard";
import { jsonResponse, errorResponse } from "../../../../../../lib/utils/api-response";
import { getStatusHistory } from "../../../../../../lib/services/order.service";

/**
 * GET /api/v1/orders/{orderId}/history/status
 *
 * Returns a chronological list of status changes for the given order.
 * Each entry contains the old/new status codes, timestamp, and the user
 * who performed the change.
 *
 * No pagination — typically a few dozen records per order at most.
 *
 * Requires: Authorization: Bearer <jwt_token>
 * Returns: ListResponse<StatusHistoryItemDto> (200) or error (401, 500)
 */
export const GET: APIRoute = async ({ locals, params }) => {
  try {
    // 1. Verify authentication
    const authResult = await requireAuth(locals.supabase);
    if (authResult instanceof Response) return authResult;

    // 2. Validate orderId parameter (must be UUID format)
    const orderId = params.orderId;
    if (!orderId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
      return errorResponse("VALIDATION_ERROR", "Nieprawidłowy format orderId (wymagany UUID)", 400);
    }

    // 3. Fetch status history from service layer
    const items = await getStatusHistory(authResult.supabase, orderId);

    // 4. Return response (empty array if no history — no need to check order existence)
    const response: ListResponse<StatusHistoryItemDto> = { items };
    return jsonResponse(response);
  } catch {
    return errorResponse("INTERNAL_ERROR", "Błąd serwera", 500);
  }
};
