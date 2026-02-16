/**
 * POST /api/v1/orders/{orderId}/lock — ustawienie blokady edycji dla bieżącego użytkownika.
 * Odpowiedź: 200 + LockOrderResponseDto. Błędy: 401, 403, 404, 409.
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  isValidUUID,
  requireWriteAccess,
} from "../../../../../lib/api-helpers";
import { lockOrder } from "../../../../../lib/services/order-lock.service";

export const POST: APIRoute = async ({ params, locals }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  const writeErr = requireWriteAccess(authResult);
  if (writeErr) return writeErr;

  const orderId = params.orderId;
  if (!orderId || !isValidUUID(orderId)) {
    return errorResponse(400, "Bad Request", "Nieprawidłowy identyfikator zlecenia (UUID).");
  }

  try {
    const result = await lockOrder(locals.supabase, authResult.id, orderId);
    if (!result) {
      return errorResponse(404, "Not Found", "Zlecenie nie zostało znalezione.");
    }
    return jsonResponse(result, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "LOCK_CONFLICT") {
      return errorResponse(
        409,
        "Conflict",
        "Zlecenie jest edytowane przez innego użytkownika. Spróbuj ponownie za chwilę."
      );
    }
    console.error("[POST /api/v1/orders/{orderId}/lock]", err);
    return errorResponse(500, "Internal Server Error", "Błąd podczas blokowania zlecenia.");
  }
};
