/**
 * POST /api/v1/orders/{orderId}/prepare-email
 *
 * Walidacja biznesowa, zmiana statusu (robocze→wysłane, korekta→korekta wysłane),
 * ustawienie sent_by_user_id i sent_at, generacja PDF, zwrot pliku .eml z załącznikiem.
 *
 * Odpowiedź: 200 + plik .eml (message/rfc822).
 * Błędy: 400 (status nie pozwala na wysyłkę), 401, 403, 404, 422 (walidacja biznesowa).
 */

import type { APIRoute } from "astro";

import {
  COMMON_HEADERS,
  errorResponse,
  getAuthenticatedUser,
  isValidUUID,
  requireWriteAccess,
  logError,
} from "../../../../../lib/api-helpers";
import { prepareEmailForOrder } from "../../../../../lib/services/order.service";
import { prepareEmailSchema } from "../../../../../lib/validators/order.validator";

export const POST: APIRoute = async ({ params, locals, request }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  const writeErr = requireWriteAccess(authResult);
  if (writeErr) return writeErr;

  const orderId = params.orderId;
  if (!orderId || !isValidUUID(orderId)) {
    return errorResponse(400, "Bad Request", "Nieprawidłowy identyfikator zlecenia (UUID).");
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

  const parsed = prepareEmailSchema.safeParse(body);
  if (!parsed.success) {
    const details: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!details[path]) details[path] = [];
      details[path].push(issue.message);
    }
    return errorResponse(400, "Bad Request", "Nieprawidłowe parametry.", details);
  }

  try {
    const result = await prepareEmailForOrder(
      locals.supabase,
      authResult.id,
      orderId,
      parsed.data
    );

    if (result === null) {
      return errorResponse(404, "Not Found", "Zlecenie nie zostało znalezione.");
    }

    if (!result.success) {
      return errorResponse(
        422,
        "Unprocessable Entity",
        "Zlecenie nie spełnia wymagań do wysyłki. Uzupełnij brakujące dane.",
        { missing: result.validationErrors }
      );
    }

    const sanitizedName = (result.orderNo || orderId).replace(/["\r\n/]/g, "-");
    const fileName = `zlecenie-${sanitizedName}.eml`;
    return new Response(result.emlContent, {
      status: 200,
      headers: {
        ...COMMON_HEADERS,
        "Content-Type": "message/rfc822",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NOT_ALLOWED_STATUS") {
      return errorResponse(
        400,
        "Bad Request",
        "Wysyłka niedozwolona dla zlecenia w tym statusie (zrealizowane, anulowane, reklamacja)."
      );
    }
    if (msg === "STATUS_CHANGED") {
      return errorResponse(
        409,
        "Conflict",
        "Status zlecenia zmienił się w trakcie operacji. Odśwież dane i spróbuj ponownie."
      );
    }
    logError("[POST /api/v1/orders/{orderId}/prepare-email]", err);
    return errorResponse(
      500,
      "Internal Server Error",
      "Błąd podczas przygotowania zlecenia do wysyłki."
    );
  }
};
