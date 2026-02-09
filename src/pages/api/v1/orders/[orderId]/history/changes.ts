import type { APIRoute } from "astro";
import type { ListResponse, ChangeLogItemDto } from "../../../../../../types";
import { requireAuth } from "../../../../../../lib/utils/auth-guard";
import { jsonResponse, errorResponse } from "../../../../../../lib/utils/api-response";
import { getChangeLog } from "../../../../../../lib/services/order.service";

/**
 * GET /api/v1/orders/{orderId}/history/changes
 *
 * Returns a chronological log of field-level changes for the given order.
 * Each entry contains the field name, old/new values, timestamp, and the
 * user who performed the change.
 *
 * No pagination — typically a few dozen records per order at most.
 *
 * Requires: Authorization: Bearer <jwt_token>
 * Returns: ListResponse<ChangeLogItemDto> (200) or error (401, 500)
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

    // 3. Fetch change log from service layer
    const items = await getChangeLog(authResult.supabase, orderId);

    // 4. Return response (empty array if no changes — no need to check order existence)
    const response: ListResponse<ChangeLogItemDto> = { items };
    return jsonResponse(response);
  } catch {
    return errorResponse("INTERNAL_ERROR", "Błąd serwera", 500);
  }
};
