/**
 * GET /api/v1/orders/{orderId}/history/changes — log zmian kluczowych pól zlecenia.
 * Odpowiedź: 200 + ListResponse<ChangeLogItemDto>. Błędy: 400, 401, 404, 500.
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  isValidUUID,
  logError,
} from "../../../../../../lib/api-helpers";
import { getChangeLog } from "../../../../../../lib/services/order-history.service";

export const GET: APIRoute = async ({ params, locals }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  const orderId = params.orderId;
  if (!orderId || !isValidUUID(orderId)) {
    return errorResponse(400, "Bad Request", "Nieprawidłowy identyfikator zlecenia (UUID).");
  }

  try {
    const items = await getChangeLog(locals.supabase, orderId);
    if (items === null) {
      return errorResponse(404, "Not Found", "Zlecenie nie zostało znalezione.");
    }
    return jsonResponse({ items }, 200);
  } catch (err) {
    logError("[GET /api/v1/orders/{orderId}/history/changes]", err);
    return errorResponse(500, "Internal Server Error", "Błąd pobierania logu zmian.");
  }
};
