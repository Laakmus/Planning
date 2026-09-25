/**
 * POST /api/v1/admin/users/:id/invite — regeneruje invite token dla usera.
 *
 * Autoryzacja: wymagana rola ADMIN.
 * Odpowiedź: 200 + { inviteLink: { url, expiresAt } }.
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  isValidUUID,
  jsonResponse,
  logError,
  requireAdmin,
} from "../../../../../../lib/api-helpers";
import {
  regenerateInvite,
} from "../../../../../../lib/services/user-admin.service";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const POST: APIRoute = async (context) => {
  const authResult = await getAuthenticatedUser(context.locals.supabase);
  if (authResult instanceof Response) return authResult;
  const forbidden = requireAdmin(authResult);
  if (forbidden) return forbidden;

  const id = context.params.id;
  if (!id || !isValidUUID(id)) {
    return errorResponse(400, "Bad Request", "Nieprawidłowy identyfikator użytkownika.");
  }

  try {
    const supabase = createAdminSupabaseClient();
    const inviteLink = await regenerateInvite(supabase, id);
    return jsonResponse({ inviteLink }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "USER_NOT_FOUND") {
      return errorResponse(404, "Not Found", "Użytkownik o podanym ID nie istnieje.");
    }
    logError("[POST /api/v1/admin/users/:id/invite]", err);
    return errorResponse(
      500,
      "Internal Server Error",
      "Wystąpił błąd podczas regeneracji invite."
    );
  }
};
