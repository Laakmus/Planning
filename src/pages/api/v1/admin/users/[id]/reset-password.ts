/**
 * POST /api/v1/admin/users/:id/reset-password — admin ustawia nowe hasło.
 *
 * Autoryzacja: wymagana rola ADMIN.
 * Body: { newPassword: string } (walidacja siły hasła w passwordSchema).
 * Odpowiedź: 204 No Content.
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  isValidUUID,
  logError,
  parseJsonBody,
  requireAdmin,
} from "../../../../../../lib/api-helpers";
import {
  resetUserPassword,
} from "../../../../../../lib/services/user-admin.service";
import { resetPasswordSchema } from "../../../../../../lib/validators/auth.validator";
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

  let body: unknown;
  try {
    body = await parseJsonBody<unknown>(context.request);
  } catch {
    return errorResponse(400, "Bad Request", "Nieprawidłowy lub pusty body JSON.");
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    const details: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!details[path]) details[path] = [];
      details[path].push(issue.message);
    }
    return errorResponse(400, "Bad Request", "Nieprawidłowe hasło.", details);
  }

  try {
    const supabase = createAdminSupabaseClient();
    await resetUserPassword(supabase, id, parsed.data.newPassword);
    return new Response(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("not found") || msg.includes("User not found")) {
      return errorResponse(404, "Not Found", "Użytkownik o podanym ID nie istnieje.");
    }
    logError("[POST /api/v1/admin/users/:id/reset-password]", err);
    return errorResponse(
      500,
      "Internal Server Error",
      "Wystąpił błąd podczas resetu hasła."
    );
  }
};
