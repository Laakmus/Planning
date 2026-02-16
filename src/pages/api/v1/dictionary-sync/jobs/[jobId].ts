/**
 * GET /api/v1/dictionary-sync/jobs/{jobId}
 *
 * Status zadania synchronizacji słowników. Na razie stub — zwraca status dla dowolnego jobId.
 * Docelowo: odczyt z kolejki zadań / tabeli jobs.
 *
 * Odpowiedź: 200 + DictionarySyncJobDto. Błędy: 401, 404 (opcjonalnie dla nieznanego jobId).
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  isValidUUID,
} from "../../../../../lib/api-helpers";

export const GET: APIRoute = async ({ params, locals }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  const jobId = params.jobId;
  if (!jobId || !isValidUUID(jobId)) {
    return errorResponse(400, "Bad Request", "Nieprawidłowy identyfikator zadania (UUID).");
  }

  return jsonResponse(
    {
      jobId,
      status: "STARTED",
      startedAt: new Date().toISOString(),
      completedAt: null,
    },
    200
  );
};
