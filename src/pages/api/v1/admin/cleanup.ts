/**
 * POST /api/v1/admin/cleanup
 *
 * Ręczne uruchomienie czyszczenia anulowanych zleceń (starsze niż 24h).
 * Wymaga roli ADMIN.
 *
 * Odpowiedź 200: { deletedCount, deletedOrderIds }
 * Błędy: 401, 403, 500
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  logError,
  requireAdmin,
} from "../../../../lib/api-helpers";
import {
  cleanupCancelledOrders,
  createServiceRoleClient,
} from "../../../../lib/services/cleanup.service";

export const POST: APIRoute = async ({ locals }) => {
  // Autoryzacja — wymagana rola ADMIN
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  const adminErr = requireAdmin(authResult);
  if (adminErr) return adminErr;

  try {
    // Używamy service_role client — cleanup wymaga pominięcia RLS
    const serviceClient = createServiceRoleClient();
    const result = await cleanupCancelledOrders(serviceClient);

    return jsonResponse({
      deletedCount: result.deletedCount,
      deletedOrderIds: result.deletedOrderIds,
    });
  } catch (err) {
    logError("[POST /api/v1/admin/cleanup]", err);
    return errorResponse(
      500,
      "Internal Server Error",
      "Błąd podczas czyszczenia anulowanych zleceń."
    );
  }
};
