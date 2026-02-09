import type { APIRoute } from "astro";
import { z } from "zod";
import { requireAuth, requireRole } from "../../../../../lib/utils/auth-guard";
import {
  jsonResponse,
  errorResponse,
} from "../../../../../lib/utils/api-response";
import { lockOrder } from "../../../../../lib/services/order.service";

/** Validates orderId path param as UUID */
const orderIdSchema = z.string().uuid("orderId musi być poprawnym UUID");

/**
 * POST /api/v1/orders/[orderId]/lock
 *
 * Acquires an edit lock on the order for the current user.
 * Prevents concurrent editing by multiple planners.
 *
 * Behavior:
 * - If unlocked → lock for current user, return 200.
 * - If already locked by the same user → refresh lock timestamp (idempotent).
 * - If locked by another user (active lock) → 409 Conflict.
 * - If locked by another user (expired lock) → take over, return 200.
 *
 * No request body required.
 *
 * Required role: ADMIN or PLANNER.
 */
export const POST: APIRoute = async ({ locals, params }) => {
  try {
    // 1. Authentication
    const authResult = await requireAuth(locals.supabase);
    if (authResult instanceof Response) return authResult;

    // 2. Role check — READ_ONLY cannot lock
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

    // 4. Execute business logic (no body needed)
    const result = await lockOrder(
      authResult.supabase,
      authResult.userId,
      orderId
    );

    // 5. Handle service-level errors
    if ("error" in result) {
      const errorMessages: Record<string, string> = {
        NOT_FOUND: "Zlecenie nie istnieje",
        ALREADY_LOCKED:
          result.message ?? "Zlecenie jest zablokowane przez innego użytkownika",
      };
      return errorResponse(
        result.error,
        errorMessages[result.error] ?? "Błąd operacji",
        result.status
      );
    }

    // 6. Return success response
    return jsonResponse(result);
  } catch {
    return errorResponse("INTERNAL_ERROR", "Błąd serwera", 500);
  }
};
