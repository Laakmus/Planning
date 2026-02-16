/**
 * GET /api/v1/orders/{orderId} — pełne dane zlecenia (nagłówek + punkty + pozycje).
 * PUT /api/v1/orders/{orderId} — pełna aktualizacja zlecenia (nagłówek + stops + items).
 * DELETE /api/v1/orders/{orderId} — anulowanie zlecenia (status → anulowane).
 *
 * Odpowiedź GET: 200 + OrderDetailResponseDto. Błędy: 401, 404.
 * Odpowiedź PUT: 200 + UpdateOrderResponseDto. Błędy: 400, 401, 403, 404, 409.
 * Odpowiedź DELETE: 200 + DeleteOrderResponseDto. Błędy: 400, 401, 403, 404.
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  isValidUUID,
  parseJsonBody,
  requireWriteAccess,
} from "../../../../../lib/api-helpers";
import { getOrderDetail, updateOrder } from "../../../../../lib/services/order.service";
import { cancelOrder } from "../../../../../lib/services/order-status.service";
import { updateOrderSchema } from "../../../../../lib/validators/order.validator";

export const GET: APIRoute = async ({ params, locals }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) {
    return authResult;
  }

  const orderId = params.orderId;
  if (!orderId || !isValidUUID(orderId)) {
    return errorResponse(400, "Bad Request", "Nieprawidłowy identyfikator zlecenia (UUID).");
  }

  const result = await getOrderDetail(locals.supabase, orderId);
  if (!result) {
    return errorResponse(404, "Not Found", "Zlecenie nie zostało znalezione.");
  }

  return jsonResponse(result, 200);
};

export const PUT: APIRoute = async ({ params, locals, request }) => {
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

  const parsed = updateOrderSchema.safeParse(body);
  if (!parsed.success) {
    const details: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!details[path]) details[path] = [];
      details[path].push(issue.message);
    }
    return errorResponse(400, "Bad Request", "Nieprawidłowe dane aktualizacji zlecenia.", details);
  }

  try {
    const result = await updateOrder(locals.supabase, authResult.id, orderId, parsed.data);
    if (!result) {
      return errorResponse(404, "Not Found", "Zlecenie nie zostało znalezione.");
    }
    return jsonResponse(result, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "LOCKED") {
      return errorResponse(
        409,
        "Conflict",
        "Zlecenie jest zablokowane przez innego użytkownika."
      );
    }
    if (msg === "FORBIDDEN_EDIT") {
      return errorResponse(
        400,
        "Bad Request",
        "Edycja niedozwolona dla zlecenia w statusie „zrealizowane” lub „anulowane”."
      );
    }
    if (msg === "STOPS_LIMIT") {
      return errorResponse(
        400,
        "Bad Request",
        "Maksymalnie 8 punktów załadunku i 3 punkty rozładunku."
      );
    }
    if (msg === "FK_VALIDATION") {
      const details = (err as Error & { details?: Record<string, string> }).details ?? {};
      return errorResponse(400, "Bad Request", "Nieprawidłowe referencje w danych zlecenia.", details);
    }
    console.error("[PUT /api/v1/orders/{orderId}]", err);
    return errorResponse(500, "Internal Server Error", "Błąd podczas aktualizacji zlecenia.");
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) {
    return authResult;
  }

  const writeErr = requireWriteAccess(authResult);
  if (writeErr) return writeErr;

  const orderId = params.orderId;
  if (!orderId || !isValidUUID(orderId)) {
    return errorResponse(400, "Bad Request", "Nieprawidłowy identyfikator zlecenia (UUID).");
  }

  try {
    const result = await cancelOrder(locals.supabase, authResult.id, orderId);
    if (!result) {
      return errorResponse(404, "Not Found", "Zlecenie nie zostało znalezione.");
    }
    return jsonResponse(result, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "FORBIDDEN_TRANSITION") {
      return errorResponse(
        400,
        "Bad Request",
        "Nie można anulować zlecenia w statusie „zrealizowane”."
      );
    }
    console.error("[DELETE /api/v1/orders/{orderId}]", err);
    return errorResponse(500, "Internal Server Error", "Błąd podczas anulowania zlecenia.");
  }
};
