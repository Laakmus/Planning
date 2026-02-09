import type { APIRoute } from "astro";
import { requireAuth, requireRole } from "../../../../lib/utils/auth-guard";
import { jsonResponse, errorResponse } from "../../../../lib/utils/api-response";
import { dictionarySyncSchema } from "../../../../lib/schemas/dictionary-sync.schema";
import { startDictionarySync } from "../../../../lib/services/dictionary-sync.service";

/**
 * POST /api/v1/dictionary-sync/run
 *
 * Triggers manual synchronization of dictionary data from the external ERP system.
 * Launches an asynchronous job that upserts companies, locations, and/or products.
 *
 * Rate-limited to max 1 sync per minute.
 *
 * Required role: ADMIN only.
 * Returns: 202 Accepted with { jobId, status: "STARTED" }
 */
export const POST: APIRoute = async ({ locals, request }) => {
  try {
    // 1. Authentication
    const authResult = await requireAuth(locals.supabase);
    if (authResult instanceof Response) return authResult;

    // 2. Role check — only ADMIN can trigger sync
    const roleCheck = requireRole(authResult.profile.role, "ADMIN");
    if (roleCheck) return roleCheck;

    // 3. Parse and validate request body
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

    const parsed = dictionarySyncSchema.safeParse(body);
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

    // 4. Execute business logic
    const result = await startDictionarySync(
      authResult.supabase,
      authResult.userId,
      parsed.data
    );

    // 5. Handle service-level errors (e.g. rate limiting)
    if ("error" in result) {
      return errorResponse(
        result.error,
        result.message ?? "Błąd operacji",
        result.status
      );
    }

    // 6. Return 202 Accepted with job reference
    return jsonResponse(result, 202);
  } catch {
    return errorResponse("INTERNAL_ERROR", "Błąd serwera", 500);
  }
};
