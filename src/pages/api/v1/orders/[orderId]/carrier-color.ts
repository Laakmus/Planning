/**
 * PATCH /api/v1/orders/{orderId}/carrier-color — set carrier cell color.
 * Body: { color: "#34d399" | "#047857" | "#fde047" | "#f97316" | null }
 * Response: 200 + CarrierColorResponseDto. Errors: 400, 401, 403, 404.
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  isValidUUID,
  parseJsonBody,
  requireWriteAccess,
  logError,
} from "../../../../../lib/api-helpers";
import { updateCarrierCellColor } from "../../../../../lib/services/order.service";
import { carrierCellColorSchema } from "../../../../../lib/validators/order.validator";

export const PATCH: APIRoute = async ({ params, locals, request }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  const writeErr = requireWriteAccess(authResult);
  if (writeErr) return writeErr;

  const orderId = params.orderId;
  if (!orderId || !isValidUUID(orderId)) {
    return errorResponse(400, "Bad Request", "Nieprawidłowy identyfikator zlecenia (UUID).");
  }

  let body: unknown;
  try {
    body = await parseJsonBody<unknown>(request);
  } catch {
    return errorResponse(400, "Bad Request", "Nieprawidłowy lub pusty body JSON.");
  }

  const parsed = carrierCellColorSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "Bad Request", "Nieprawidłowy kolor. Dozwolone: #34d399, #047857, #fde047, #f97316 lub null.");
  }

  try {
    const result = await updateCarrierCellColor(
      locals.supabase,
      orderId,
      parsed.data.color
    );
    if (!result) {
      return errorResponse(404, "Not Found", "Zlecenie nie zostało znalezione.");
    }
    return jsonResponse(result, 200);
  } catch (err) {
    logError("[PATCH /api/v1/orders/{orderId}/carrier-color]", err);
    return errorResponse(500, "Internal Server Error", "Błąd podczas ustawiania koloru.");
  }
};
