import type { APIRoute } from "astro";
import { z } from "zod";
import { requireAuth, requireRole } from "../../../../../lib/utils/auth-guard";
import {
  jsonResponse,
  errorResponse,
} from "../../../../../lib/utils/api-response";
import { restoreOrderSchema } from "../../../../../lib/schemas/restore-order.schema";
import { restoreOrder } from "../../../../../lib/services/order.service";

/** Validates orderId path param as UUID */
const orderIdSchema = z.string().uuid("orderId musi być poprawnym UUID");

/**
 * POST /api/v1/orders/[orderId]/restore
 *
 * Restores an order from the "Completed" (ZRE) or "Cancelled" (ANL) tab
 * back to the "Current" tab with a chosen target status (ROB or WYS).
 *
 * For cancelled orders (ANL), restore is only possible within 24 hours
 * of cancellation.
 *
 * Required role: ADMIN or PLANNER.
 */
export const POST: APIRoute = async ({ locals, params, request }) => {
  try {
    // 1. Authentication
    const authResult = await requireAuth(locals.supabase);
    if (authResult instanceof Response) return authResult;

    // 2. Role check
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

    // 4. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "VALIDATION_ERROR",
        "Nieprawidłowy format JSON",
        400
      );
    }

    const parsed = restoreOrderSchema.safeParse(body);
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
    const result = await restoreOrder(
      authResult.supabase,
      authResult.userId,
      orderId,
      parsed.data
    );

    // 6. Handle service-level errors
    if ("error" in result) {
      const errorMessages: Record<string, string> = {
        NOT_FOUND: "Zlecenie nie istnieje",
        RESTORE_NOT_ALLOWED:
          result.message ?? "Przywracanie tego zlecenia jest niedozwolone",
        RESTORE_WINDOW_EXPIRED:
          result.message ?? "Okres przywrócenia wygasł",
      };
      return errorResponse(
        result.error,
        errorMessages[result.error] ?? "Błąd operacji",
        result.status
      );
    }

    // 7. Return success response
    return jsonResponse(result);
  } catch {
    return errorResponse("INTERNAL_ERROR", "Błąd serwera", 500);
  }
};
