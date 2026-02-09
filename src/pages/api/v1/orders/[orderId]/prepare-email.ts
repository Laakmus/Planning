import type { APIRoute } from "astro";
import { z } from "zod";
import { requireAuth, requireRole } from "../../../../../lib/utils/auth-guard";
import { jsonResponse, errorResponse } from "../../../../../lib/utils/api-response";
import { prepareEmailSchema } from "../../../../../lib/schemas/prepare-email.schema";
import { prepareOrderEmail } from "../../../../../lib/services/email.service";

/** Validates orderId path param as UUID */
const orderIdSchema = z.string().uuid("orderId musi być poprawnym UUID");

/**
 * POST /api/v1/orders/{orderId}/prepare-email
 *
 * Key workflow endpoint: validates order completeness for sending,
 * generates/refreshes the PDF, transitions status (ROB→WYS, KOR→KOR_WYS),
 * and returns a mailto: URL for opening the email client.
 *
 * Request body (optional):
 *   { "forceRegeneratePdf": true }  — forces PDF regeneration.
 *
 * Required role: ADMIN or PLANNER.
 *
 * Returns:
 *   200 — PrepareEmailResponseDto (success)
 *   401 — Unauthorized
 *   403 — Forbidden (READ_ONLY role or status doesn't allow sending)
 *   404 — Order not found
 *   422 — Validation failed (incomplete order data, with details)
 *   500 — Internal error
 */
export const POST: APIRoute = async ({ locals, params, request }) => {
  try {
    // 1. Authentication
    const authResult = await requireAuth(locals.supabase);
    if (authResult instanceof Response) return authResult;

    // 2. Role check — only ADMIN and PLANNER can prepare emails
    const roleCheck = requireRole(authResult.profile.role, "ADMIN", "PLANNER");
    if (roleCheck) return roleCheck;

    // 3. Validate orderId path parameter
    const orderIdResult = orderIdSchema.safeParse(params.orderId);
    if (!orderIdResult.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Nieprawidłowy identyfikator zlecenia",
        400,
        orderIdResult.error.issues.map((i) => ({
          field: "orderId",
          message: i.message,
        }))
      );
    }
    const orderId = orderIdResult.data;

    // 4. Parse optional request body
    let body: unknown = {};
    try {
      const text = await request.text();
      if (text.trim().length > 0) {
        body = JSON.parse(text);
      }
    } catch {
      return errorResponse("VALIDATION_ERROR", "Nieprawidłowy format JSON", 400);
    }

    const parsed = prepareEmailSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Błędy walidacji danych",
        400,
        parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        }))
      );
    }

    // 5. Execute business logic
    const result = await prepareOrderEmail(
      authResult.supabase,
      authResult.userId,
      orderId,
      parsed.data
    );

    // 6. Handle service-level errors
    if ("error" in result) {
      // 422 — business validation failed (incomplete data for sending)
      if (result.error === "VALIDATION_FAILED" && result.details) {
        return errorResponse(
          result.error,
          result.message ?? "Dane niekompletne do wysyłki zlecenia",
          result.status,
          result.details
        );
      }

      // Other errors (404, 403, etc.)
      const messages: Record<string, string> = {
        NOT_FOUND: "Zlecenie nie istnieje",
        STATUS_NOT_ALLOWED:
          result.message ?? "Status zlecenia nie pozwala na wysyłkę",
      };

      return errorResponse(
        result.error,
        messages[result.error] ?? result.message ?? "Błąd operacji",
        result.status
      );
    }

    // 7. Return success response
    return jsonResponse(result);
  } catch {
    return errorResponse("INTERNAL_ERROR", "Błąd serwera", 500);
  }
};
