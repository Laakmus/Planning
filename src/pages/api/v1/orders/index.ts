import type { APIRoute } from "astro";
import { requireAuth, requireRole } from "../../../../lib/utils/auth-guard";
import { jsonResponse, errorResponse } from "../../../../lib/utils/api-response";
import { orderListQuerySchema } from "../../../../lib/schemas/order-list.schema";
import { createOrderSchema } from "../../../../lib/schemas/create-order.schema";
import { listOrders, createOrder } from "../../../../lib/services/order.service";

/**
 * GET /api/v1/orders
 *
 * Returns a paginated list of transport orders with filters, sorting, and search.
 * Supports three view tabs: CURRENT, COMPLETED, CANCELLED.
 *
 * All query params are optional — defaults: view=CURRENT, page=1, pageSize=50,
 * sortBy=FIRST_LOADING_DATETIME, sortDirection=ASC.
 */
export const GET: APIRoute = async ({ locals, url }) => {
  try {
    const authResult = await requireAuth(locals.supabase);
    if (authResult instanceof Response) return authResult;

    // Handle multi-value status param: ?status=ROB&status=WYS
    const rawParams: Record<string, unknown> = Object.fromEntries(
      url.searchParams
    );
    const statusValues = url.searchParams.getAll("status");
    if (statusValues.length > 1) {
      rawParams.status = statusValues;
    }

    // Validate query params
    const parsed = orderListQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Nieprawidłowe parametry zapytania",
        400,
        parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        }))
      );
    }

    const result = await listOrders(authResult.supabase, parsed.data);

    return jsonResponse(result);
  } catch {
    return errorResponse("INTERNAL_ERROR", "Błąd serwera", 500);
  }
};

/**
 * POST /api/v1/orders
 *
 * Creates a new transport order in draft status (ROB).
 * The order can be incomplete — full business validation happens at prepare-email.
 *
 * Required role: ADMIN or PLANNER.
 */
export const POST: APIRoute = async ({ locals, request }) => {
  try {
    const authResult = await requireAuth(locals.supabase);
    if (authResult instanceof Response) return authResult;

    // Check role — only ADMIN and PLANNER can create orders
    const roleCheck = requireRole(authResult.profile.role, "ADMIN", "PLANNER");
    if (roleCheck) return roleCheck;

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("VALIDATION_ERROR", "Nieprawidłowy format JSON", 400);
    }

    const parsed = createOrderSchema.safeParse(body);
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

    const result = await createOrder(
      authResult.supabase,
      authResult.userId,
      parsed.data
    );

    return jsonResponse(result, 201);
  } catch {
    return errorResponse("INTERNAL_ERROR", "Błąd serwera", 500);
  }
};
