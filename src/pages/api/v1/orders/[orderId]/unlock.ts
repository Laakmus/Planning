/**
 * POST /api/v1/orders/{orderId}/unlock — zwolnienie blokady edycji.
 * Odblokować może właściciel blokady lub ADMIN.
 * Odpowiedź: 200 + UnlockOrderResponseDto. Błędy: 401, 403, 404.
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  isValidUUID,
} from "../../../../../lib/api-helpers";
import { unlockOrder } from "../../../../../lib/services/order-lock.service";

export const POST: APIRoute = async ({ params, locals }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  const orderId = params.orderId;
  if (!orderId || !isValidUUID(orderId)) {
    return errorResponse(400, "Bad Request", "Nieprawidłowy identyfikator zlecenia (UUID).");
  }

  const canUnlockOther = authResult.role === "ADMIN";

  try {
    const result = await unlockOrder(
      locals.supabase,
      authResult.id,
      orderId,
      canUnlockOther
    );
    if (!result) {
      return errorResponse(404, "Not Found", "Zlecenie nie zostało znalezione.");
    }
    return jsonResponse(result, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "FORBIDDEN_UNLOCK") {
      return errorResponse(
        403,
        "Forbidden",
        "Możesz odblokować tylko własną blokadę. Odblokowanie cudzej wymaga roli ADMIN."
      );
    }
    console.error("[POST /api/v1/orders/{orderId}/unlock]", err);
    return errorResponse(500, "Internal Server Error", "Błąd podczas odblokowywania zlecenia.");
  }
};
