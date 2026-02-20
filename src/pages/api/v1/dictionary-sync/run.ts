/**
 * POST /api/v1/dictionary-sync/run
 *
 * Uruchomienie synchronizacji słowników z ERP. Na razie stub — zwraca jobId i status STARTED.
 * Docelowo: kolejka zadań, integracja z ERP (COMPANIES, LOCATIONS, PRODUCTS).
 *
 * Odpowiedź: 200 + DictionarySyncResponseDto. Błędy: 400, 401, 403.
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  parseJsonBody,
  requireWriteAccess,
} from "../../../../lib/api-helpers";
import { dictionarySyncSchema } from "../../../../lib/validators/order.validator";

export const POST: APIRoute = async ({ locals, request }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  const writeErr = requireWriteAccess(authResult);
  if (writeErr) return writeErr;

  let body: unknown;
  try {
    body = await parseJsonBody<unknown>(request);
  } catch {
    return errorResponse(400, "Bad Request", "Nieprawidłowy lub pusty body JSON.");
  }

  const parsed = dictionarySyncSchema.safeParse(body);
  if (!parsed.success) {
    const details: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!details[path]) details[path] = [];
      details[path].push(issue.message);
    }
    return errorResponse(400, "Bad Request", "Nieprawidłowe parametry synchronizacji.", details);
  }

  const jobId = crypto.randomUUID();
  return jsonResponse(
    {
      jobId,
      status: "STARTED",
    },
    200
  );
};
