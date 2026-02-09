import type { APIRoute } from "astro";
import { z } from "zod";
import { requireAuth } from "../../../../../lib/utils/auth-guard";
import {
  jsonResponse,
  errorResponse,
} from "../../../../../lib/utils/api-response";
import { unlockOrder } from "../../../../../lib/services/order.service";

/** Validates orderId path param as UUID */
const orderIdSchema = z.string().uuid("orderId musi być poprawnym UUID");

/**
 * POST /api/v1/orders/[orderId]/unlock
 *
 * Releases the edit lock on the order.
 * Called after saving or when leaving the edit form.
 *
 * Behavior:
 * - If locked by the current user → unlock, return 200.
 * - If locked by another user and current user is ADMIN → force unlock.
 * - If locked by another user and current user is not ADMIN → 403.
 * - If not locked at all → return 200 (idempotent).
 *
 * No request body required.
 *
 * Any authenticated user can attempt unlock; role-based permission
 * (own lock vs ADMIN override) is checked in the service layer.
 */
export const POST: APIRoute = async ({ locals, params }) => {
  try {
    // 1. Authentication (any role can attempt unlock)
    const authResult = await requireAuth(locals.supabase);
    if (authResult instanceof Response) return authResult;

    // 2. Validate orderId path parameter
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

    // 3. Execute business logic (no body needed)
    const result = await unlockOrder(
      authResult.supabase,
      authResult.userId,
      authResult.profile.role,
      orderId
    );

    // 4. Handle service-level errors
    if ("error" in result) {
      const errorMessages: Record<string, string> = {
        NOT_FOUND: "Zlecenie nie istnieje",
        FORBIDDEN:
          result.message ?? "Brak uprawnień do odblokowania tego zlecenia",
      };
      return errorResponse(
        result.error,
        errorMessages[result.error] ?? "Błąd operacji",
        result.status
      );
    }

    // 5. Return success response
    return jsonResponse(result);
  } catch {
    return errorResponse("INTERNAL_ERROR", "Błąd serwera", 500);
  }
};
