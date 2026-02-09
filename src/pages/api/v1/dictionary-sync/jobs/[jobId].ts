import type { APIRoute } from "astro";
import { requireAuth, requireRole } from "../../../../../lib/utils/auth-guard";
import { jsonResponse, errorResponse } from "../../../../../lib/utils/api-response";
import { getJobStatus } from "../../../../../lib/services/dictionary-sync.service";

/**
 * GET /api/v1/dictionary-sync/jobs/{jobId}
 *
 * Returns the current status of a dictionary synchronization job.
 * Used to poll for completion after triggering a sync via POST /dictionary-sync/run.
 *
 * Required role: ADMIN only (consistent with the sync trigger endpoint).
 * Returns: DictionarySyncJobDto (200) or error (401, 403, 404)
 */
export const GET: APIRoute = async ({ locals, params }) => {
  try {
    // 1. Authentication
    const authResult = await requireAuth(locals.supabase);
    if (authResult instanceof Response) return authResult;

    // 2. Role check — only ADMIN can check sync status
    const roleCheck = requireRole(authResult.profile.role, "ADMIN");
    if (roleCheck) return roleCheck;

    // 3. Validate jobId parameter (must be UUID format)
    const jobId = params.jobId;
    if (!jobId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
      return errorResponse("VALIDATION_ERROR", "Nieprawidłowy format jobId (wymagany UUID)", 400);
    }

    // 4. Look up job status
    const job = getJobStatus(jobId);

    if (!job) {
      return errorResponse("NOT_FOUND", "Zadanie synchronizacji nie istnieje", 404);
    }

    // 5. Return job status
    return jsonResponse(job);
  } catch {
    return errorResponse("INTERNAL_ERROR", "Błąd serwera", 500);
  }
};
