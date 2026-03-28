/**
 * POST /api/v1/orders/{orderId}/restore — przywrócenie z zrealizowane/anulowane do aktualnych (status = korekta).
 * Z anulowane tylko jeśli < 24h od anulowania (w przeciwnym razie 410 Gone).
 * Odpowiedź: 200 + RestoreOrderResponseDto. Błędy: 400, 401, 403, 404, 410.
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  isValidUUID,
  requireWriteAccess,
  logError,
} from "../../../../../lib/api-helpers";
import { restoreOrder } from "../../../../../lib/services/order-status.service";

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
    const result = await restoreOrder(locals.supabase, authResult.id, orderId);
    if (!result) {
      return errorResponse(404, "Not Found", "Zlecenie nie zostało znalezione.");
    }
    return jsonResponse(result, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "FORBIDDEN_RESTORE") {
      return errorResponse(
        400,
        "Bad Request",
        "Przywracanie możliwe tylko ze statusu „zrealizowane” lub „anulowane”."
      );
    }
    if (msg === "GONE_24H") {
      return errorResponse(
        410,
        "Gone",
        "Zlecenie anulowane ponad 24h temu — przywracanie niedostępne."
      );
    }
    logError("[POST /api/v1/orders/{orderId}/restore]", err);
    return errorResponse(500, "Internal Server Error", "Błąd podczas przywracania zlecenia.");
  }
};
