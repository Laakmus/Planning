/**
 * POST /api/v1/orders/{orderId}/pdf
 *
 * Generowanie PDF zlecenia. Na razie stub — 501 Not Implemented.
 * Docelowo: auth, pobranie zlecenia, generacja PDF, zwrot application/pdf.
 *
 * Błędy: 400, 401, 404, 501 (stub).
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  isValidUUID,
} from "../../../../../lib/api-helpers";
import { getOrderDetail } from "../../../../../lib/services/order.service";

export const POST: APIRoute = async ({ params, locals }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  const orderId = params.orderId;
  if (!orderId || !isValidUUID(orderId)) {
    return errorResponse(400, "Bad Request", "Nieprawidłowy identyfikator zlecenia (UUID).");
  }

  const order = await getOrderDetail(locals.supabase, orderId);
  if (!order) {
    return errorResponse(404, "Not Found", "Zlecenie nie zostało znalezione.");
  }

  return errorResponse(
    501,
    "Not Implemented",
    "Generowanie PDF zlecenia nie jest jeszcze zaimplementowane."
  );
};
