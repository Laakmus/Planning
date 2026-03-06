/**
 * POST /api/v1/orders/{orderId}/status — ręczna zmiana statusu (zrealizowane, reklamacja, anulowane).
 * Body: { newStatusCode, complaintReason? } (complaintReason wymagane przy reklamacja).
 * Odpowiedź: 200 + ChangeStatusResponseDto. Błędy: 400, 401, 403, 404, 422.
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
import { changeStatus } from "../../../../../lib/services/order-status.service";
import { changeStatusSchema } from "../../../../../lib/validators/order.validator";

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

  const parsed = changeStatusSchema.safeParse(body);
  if (!parsed.success) {
    const details: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!details[path]) details[path] = [];
      details[path].push(issue.message);
    }
    const isComplaintReason = parsed.error.issues.some((i) => i.path.includes("complaintReason"));
    return errorResponse(
      isComplaintReason ? 422 : 400,
      isComplaintReason ? "Unprocessable Entity" : "Bad Request",
      "Nieprawidłowe dane zmiany statusu.",
      details
    );
  }

  try {
    const result = await changeStatus(
      locals.supabase,
      authResult.id,
      orderId,
      parsed.data
    );
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
        "Niedozwolone przejście statusu dla tego zlecenia."
      );
    }
    logError("[POST /api/v1/orders/{orderId}/status]", err);
    return errorResponse(500, "Internal Server Error", "Błąd podczas zmiany statusu.");
  }
};
