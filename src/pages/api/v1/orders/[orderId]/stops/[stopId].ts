/**
 * PATCH /api/v1/orders/{orderId}/stops/{stopId}
 *
 * Częściowa edycja pojedynczego punktu trasy. Wymaga odblokowanego zlecenia lub blokady przez bieżącego użytkownika.
 * Po zapisie przeliczane są first/last loading/unloading na zleceniu.
 *
 * Odpowiedź: 200 + PatchStopResponseDto. Błędy: 400, 401, 403, 404, 409.
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
} from "../../../../../../lib/api-helpers";
import { patchStop } from "../../../../../../lib/services/order.service";
import { patchStopSchema } from "../../../../../../lib/validators/order.validator";

export const PATCH: APIRoute = async ({ params, locals, request }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  const writeErr = requireWriteAccess(authResult);
  if (writeErr) return writeErr;

  const orderId = params.orderId;
  const stopId = params.stopId;
  if (!orderId || !isValidUUID(orderId)) {
    return errorResponse(400, "Bad Request", "Nieprawidłowy identyfikator zlecenia (UUID).");
  }
  if (!stopId || !isValidUUID(stopId)) {
    return errorResponse(400, "Bad Request", "Nieprawidłowy identyfikator punktu trasy (UUID).");
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text);
    }
  } catch {
    return errorResponse(400, "Bad Request", "Nieprawidłowy body JSON.");
  }

  const parsed = patchStopSchema.safeParse(body);
  if (!parsed.success) {
    const details: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!details[path]) details[path] = [];
      details[path].push(issue.message);
    }
    return errorResponse(400, "Bad Request", "Nieprawidłowe dane punktu trasy.", details);
  }

  if (Object.keys(parsed.data).length === 0) {
    return errorResponse(400, "Bad Request", "Podaj co najmniej jedno pole do aktualizacji.");
  }

  try {
    const result = await patchStop(
      locals.supabase,
      authResult.id,
      orderId,
      stopId,
      parsed.data
    );
    if (!result) {
      return errorResponse(404, "Not Found", "Zlecenie lub punkt trasy nie zostały znalezione.");
    }
    return jsonResponse(result, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "READONLY") {
      return errorResponse(
        400,
        "Bad Request",
        "Edycja niedozwolona — zlecenie w statusie zrealizowane lub anulowane."
      );
    }
    if (msg === "FORBIDDEN_EDIT") {
      return errorResponse(
        409,
        "Conflict",
        "Zlecenie zostało zmodyfikowane równolegle. Odśwież i spróbuj ponownie."
      );
    }
    if (msg === "LOCKED") {
      return errorResponse(
        409,
        "Conflict",
        "Zlecenie jest zablokowane przez innego użytkownika."
      );
    }
    if (msg === "INVALID_ROUTE_ORDER") {
      return errorResponse(
        400,
        "Bad Request",
        "Zmiana typu stopu narusza kolejność trasy (pierwszy = załadunek, ostatni = rozładunek)."
      );
    }
    logError("[PATCH /api/v1/orders/{orderId}/stops/{stopId}]", err);
    return errorResponse(500, "Internal Server Error", "Błąd podczas aktualizacji punktu trasy.");
  }
};
