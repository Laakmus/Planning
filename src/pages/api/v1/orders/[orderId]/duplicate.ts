/**
 * POST /api/v1/orders/{orderId}/duplicate
 *
 * Kopiuje zlecenie: nowy numer, opcjonalnie punkty trasy i pozycje, opcjonalnie status robocze.
 * Odpowiedź: 201 + DuplicateOrderResponseDto. Błędy: 400, 401, 403, 404.
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
import { duplicateOrder } from "../../../../../lib/services/order.service";
import { duplicateOrderSchema } from "../../../../../lib/validators/order.validator";

export const POST: APIRoute = async ({ params, locals, request }) => {
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

  const parsed = duplicateOrderSchema.safeParse(body);
  if (!parsed.success) {
    const details: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!details[path]) details[path] = [];
      details[path].push(issue.message);
    }
    return errorResponse(400, "Bad Request", "Nieprawidłowe parametry kopiowania.", details);
  }

  try {
    const result = await duplicateOrder(locals.supabase, authResult.id, orderId, parsed.data);
    if (!result) {
      return errorResponse(404, "Not Found", "Zlecenie nie zostało znalezione.");
    }
    return jsonResponse(result, 201);
  } catch (err) {
    // M-05: Obsługa FK_VALIDATION — klucze obce do nieaktywnych/usuniętych rekordów
    const msg = err instanceof Error ? err.message : "";
    if (msg === "FK_VALIDATION") {
      return errorResponse(
        422,
        "Unprocessable Entity",
        "Zlecenie zawiera odniesienia do nieaktywnych lub usuniętych rekordów słownikowych."
      );
    }
    console.error("[POST /api/v1/orders/{orderId}/duplicate]", err);
    return errorResponse(
      500,
      "Internal Server Error",
      "Błąd podczas kopiowania zlecenia."
    );
  }
};
