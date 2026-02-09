import type { APIRoute } from "astro";
import { z } from "zod";
import { requireAuth, requireRole } from "../../../../../../lib/utils/auth-guard";
import {
  jsonResponse,
  errorResponse,
} from "../../../../../../lib/utils/api-response";
import { patchStopSchema } from "../../../../../../lib/schemas/patch-stop.schema";
import { patchStop } from "../../../../../../lib/services/order.service";

/** Validates UUID path params */
const uuidSchema = z.string().uuid();

/**
 * PATCH /api/v1/orders/[orderId]/stops/[stopId]
 *
 * Partially updates a single order stop (date, time, location, notes).
 * At least one field must be provided in the request body.
 *
 * If locationId is changed, snapshot data (location_name, company_name,
 * address) is re-resolved from the locations table.
 *
 * If a business field (date, time, location) is changed and the order
 * status is WYS or KOR_WYS, the status automatically transitions to KOR.
 *
 * Required role: ADMIN or PLANNER.
 */
export const PATCH: APIRoute = async ({ locals, params, request }) => {
  try {
    // 1. Authentication
    const authResult = await requireAuth(locals.supabase);
    if (authResult instanceof Response) return authResult;

    // 2. Role check
    const roleCheck = requireRole(authResult.profile.role, "ADMIN", "PLANNER");
    if (roleCheck) return roleCheck;

    // 3. Validate path parameters
    const orderIdResult = uuidSchema.safeParse(params.orderId);
    if (!orderIdResult.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Nieprawidłowy identyfikator zlecenia",
        400,
        [{ field: "orderId", message: "orderId musi być poprawnym UUID" }]
      );
    }

    const stopIdResult = uuidSchema.safeParse(params.stopId);
    if (!stopIdResult.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Nieprawidłowy identyfikator punktu trasy",
        400,
        [{ field: "stopId", message: "stopId musi być poprawnym UUID" }]
      );
    }

    const orderId = orderIdResult.data;
    const stopId = stopIdResult.data;

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

    const parsed = patchStopSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Błędy walidacji danych",
        400,
        parsed.error.issues.map((i) => ({
          field: i.path.join(".") || "_root",
          message: i.message,
        }))
      );
    }

    // 5. Execute business logic
    const result = await patchStop(
      authResult.supabase,
      authResult.userId,
      orderId,
      stopId,
      parsed.data
    );

    // 6. Handle service-level errors
    if ("error" in result) {
      const errorMessages: Record<string, string> = {
        NOT_FOUND: result.message ?? "Nie znaleziono zasobu",
        LOCKED: result.message ?? "Zlecenie jest zablokowane",
        STATUS_NOT_EDITABLE: result.message ?? "Status nie pozwala na edycję",
      };
      return errorResponse(
        result.error,
        errorMessages[result.error] ?? "Błąd operacji",
        result.status
      );
    }

    // 7. Return updated stop
    return jsonResponse(result);
  } catch {
    return errorResponse("INTERNAL_ERROR", "Błąd serwera", 500);
  }
};
