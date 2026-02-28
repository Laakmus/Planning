/**
 * PATCH /api/v1/orders/{orderId}/entry-fixed — ustawia pole Fix (is_entry_fixed).
 * Body: { isEntryFixed: true | false | null }
 * Response: 200 + EntryFixedResponseDto. Errors: 400, 401, 403, 404.
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  isValidUUID,
  parseJsonBody,
  requireWriteAccess,
} from "../../../../../lib/api-helpers";
import { updateEntryFixed } from "../../../../../lib/services/order.service";
import { entryFixedSchema } from "../../../../../lib/validators/order.validator";

export const PATCH: APIRoute = async ({ params, locals, request }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  const writeErr = requireWriteAccess(authResult);
  if (writeErr) return writeErr;

  const orderId = params.orderId;
  if (!orderId || !isValidUUID(orderId)) {
    return errorResponse(400, "Bad Request", "Nieprawidłowy identyfikator zlecenia (UUID).");
  }

  let body: unknown;
  try {
    body = await parseJsonBody<unknown>(request);
  } catch {
    return errorResponse(400, "Bad Request", "Nieprawidłowy lub pusty body JSON.");
  }

  const parsed = entryFixedSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "Bad Request", "Nieprawidłowa wartość isEntryFixed. Dozwolone: true, false lub null.");
  }

  try {
    const result = await updateEntryFixed(
      locals.supabase,
      orderId,
      authResult.id,
      parsed.data.isEntryFixed
    );
    if (!result) {
      return errorResponse(404, "Not Found", "Zlecenie nie zostało znalezione.");
    }
    return jsonResponse(result, 200);
  } catch (err) {
    console.error("[PATCH /api/v1/orders/{orderId}/entry-fixed]", err);
    return errorResponse(500, "Internal Server Error", "Błąd podczas ustawiania pola Fix.");
  }
};
