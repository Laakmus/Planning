import type { APIRoute } from "astro";
import { z } from "zod";
import { requireAuth, requireRole } from "../../../../lib/utils/auth-guard";
import { jsonResponse, errorResponse } from "../../../../lib/utils/api-response";
import { updateOrderSchema } from "../../../../lib/schemas/update-order.schema";
import {
  getOrderById,
  updateOrder,
  cancelOrder,
} from "../../../../lib/services/order.service";

/** Validates orderId path param as UUID */
const orderIdSchema = z.string().uuid("orderId musi być poprawnym UUID");

/**
 * Shared helper — validates orderId and returns parsed value or error Response.
 */
function validateOrderId(orderId: string | undefined): string | Response {
  const result = orderIdSchema.safeParse(orderId);
  if (!result.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Nieprawidłowy identyfikator zlecenia",
      400,
      result.error.issues.map((i) => ({
        field: "orderId",
        message: i.message,
      }))
    );
  }
  return result.data;
}

/**
 * GET /api/v1/orders/[orderId]
 *
 * Returns full order details: header (OrderDetailDto),
 * stops (OrderDetailStopDto[]), and items (OrderDetailItemDto[]).
 */
export const GET: APIRoute = async ({ locals, params }) => {
  try {
    const authResult = await requireAuth(locals.supabase);
    if (authResult instanceof Response) return authResult;

    const orderId = validateOrderId(params.orderId);
    if (orderId instanceof Response) return orderId;

    const result = await getOrderById(authResult.supabase, orderId);

    if (!result) {
      return errorResponse("NOT_FOUND", "Zlecenie nie istnieje", 404);
    }

    return jsonResponse(result);
  } catch {
    return errorResponse("INTERNAL_ERROR", "Błąd serwera", 500);
  }
};

/**
 * PUT /api/v1/orders/[orderId]
 *
 * Full update of a transport order (header + stops + items).
 * Status is NOT changed directly — automatic WYS/KOR_WYS → KOR transition
 * happens server-side when business fields change.
 *
 * Required role: ADMIN or PLANNER.
 */
export const PUT: APIRoute = async ({ locals, params, request }) => {
  try {
    const authResult = await requireAuth(locals.supabase);
    if (authResult instanceof Response) return authResult;

    const roleCheck = requireRole(authResult.profile.role, "ADMIN", "PLANNER");
    if (roleCheck) return roleCheck;

    const orderId = validateOrderId(params.orderId);
    if (orderId instanceof Response) return orderId;

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("VALIDATION_ERROR", "Nieprawidłowy format JSON", 400);
    }

    const parsed = updateOrderSchema.safeParse(body);
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

    const result = await updateOrder(
      authResult.supabase,
      authResult.userId,
      orderId,
      parsed.data
    );

    // Service returns error object for business errors
    if ("error" in result) {
      const errorMessages: Record<string, string> = {
        NOT_FOUND: "Zlecenie nie istnieje",
        LOCKED: "Zlecenie jest zablokowane przez innego użytkownika",
        STATUS_NOT_EDITABLE: "Status zlecenia nie pozwala na edycję",
      };
      return errorResponse(
        result.error,
        errorMessages[result.error] ?? "Błąd operacji",
        result.status
      );
    }

    return jsonResponse(result);
  } catch {
    return errorResponse("INTERNAL_ERROR", "Błąd serwera", 500);
  }
};

/**
 * DELETE /api/v1/orders/[orderId]
 *
 * Cancels an order by setting status to ANL.
 * Also releases any lock and logs the status change.
 *
 * Required role: ADMIN or PLANNER.
 */
export const DELETE: APIRoute = async ({ locals, params }) => {
  try {
    const authResult = await requireAuth(locals.supabase);
    if (authResult instanceof Response) return authResult;

    const roleCheck = requireRole(authResult.profile.role, "ADMIN", "PLANNER");
    if (roleCheck) return roleCheck;

    const orderId = validateOrderId(params.orderId);
    if (orderId instanceof Response) return orderId;

    const result = await cancelOrder(
      authResult.supabase,
      authResult.userId,
      orderId
    );

    if ("error" in result) {
      const errorMessages: Record<string, string> = {
        NOT_FOUND: "Zlecenie nie istnieje",
      };
      return errorResponse(
        result.error,
        errorMessages[result.error] ?? "Błąd operacji",
        result.status
      );
    }

    return jsonResponse(result);
  } catch {
    return errorResponse("INTERNAL_ERROR", "Błąd serwera", 500);
  }
};
