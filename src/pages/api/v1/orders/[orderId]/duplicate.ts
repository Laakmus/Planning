import type { APIRoute } from "astro";
import { z } from "zod";
import { requireAuth, requireRole } from "../../../../../lib/utils/auth-guard";
import {
  jsonResponse,
  errorResponse,
} from "../../../../../lib/utils/api-response";
import { duplicateOrderSchema } from "../../../../../lib/schemas/duplicate-order.schema";
import { duplicateOrder } from "../../../../../lib/services/order.service";

/** Validates orderId path param as UUID */
const orderIdSchema = z.string().uuid("orderId musi być poprawnym UUID");

/**
 * POST /api/v1/orders/[orderId]/duplicate
 *
 * Creates a new order based on an existing one (template).
 * The new order receives a fresh id, new order_no, and status ROB.
 *
 * Options (all default to true):
 * - includeStops — copy loading/unloading stops
 * - includeItems — copy product items
 * - resetStatusToDraft — set status to ROB (currently always true)
 *
 * Required role: ADMIN or PLANNER.
 *
 * Returns 201 Created with the new order's id, orderNo, and statusCode.
 */
export const POST: APIRoute = async ({ locals, params, request }) => {
  try {
    // 1. Authentication
    const authResult = await requireAuth(locals.supabase);
    if (authResult instanceof Response) return authResult;

    // 2. Role check — READ_ONLY cannot duplicate
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

    // 4. Parse and validate request body (body is optional — defaults apply)
    let body: unknown = {};
    try {
      const text = await request.text();
      if (text.trim().length > 0) {
        body = JSON.parse(text);
      }
    } catch {
      return errorResponse(
        "VALIDATION_ERROR",
        "Nieprawidłowy format JSON",
        400
      );
    }

    const parsed = duplicateOrderSchema.safeParse(body);
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
    const result = await duplicateOrder(
      authResult.supabase,
      authResult.userId,
      orderId,
      parsed.data
    );

    // 6. Handle service-level errors
    if ("error" in result) {
      const errorMessages: Record<string, string> = {
        NOT_FOUND: "Zlecenie źródłowe nie istnieje",
      };
      return errorResponse(
        result.error,
        errorMessages[result.error] ?? "Błąd operacji",
        result.status
      );
    }

    // 7. Return 201 Created
    return jsonResponse(result, 201);
  } catch {
    return errorResponse("INTERNAL_ERROR", "Błąd serwera", 500);
  }
};
