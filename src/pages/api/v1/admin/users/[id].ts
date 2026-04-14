/**
 * PATCH  /api/v1/admin/users/:id — aktualizacja profilu usera (email/role/isActive/...).
 * DELETE /api/v1/admin/users/:id — miękka deaktywacja (is_active=false + signOut).
 *
 * Autoryzacja: wymagana rola ADMIN. Admin nie może deaktywować własnego konta.
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  isValidUUID,
  jsonResponse,
  logError,
  parseJsonBody,
} from "../../../../../lib/api-helpers";
import { requireAdmin } from "../../../../../lib/auth/requireAdmin";
import {
  createAdminSupabaseClient,
  deactivateUser,
  updateUser,
} from "../../../../../lib/services/user-admin.service";
import { updateUserSchema } from "../../../../../lib/validators/auth.validator";

// ---------------------------------------------------------------------------
// PATCH /api/v1/admin/users/:id
// ---------------------------------------------------------------------------

export const PATCH: APIRoute = async (context) => {
  const authResult = await requireAdmin(context);
  if (authResult instanceof Response) return authResult;

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

  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    const details: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!details[path]) details[path] = [];
      details[path].push(issue.message);
    }
    return errorResponse(400, "Bad Request", "Nieprawidłowe dane użytkownika.", details);
  }

  try {
    const supabase = createAdminSupabaseClient();
    // authResult z requireAdmin powinien zawierać userId — defensywne rzutowanie
    const currentUserId = (authResult as { userId?: string; id?: string }).userId
      ?? (authResult as { userId?: string; id?: string }).id
      ?? "";
    const result = await updateUser(supabase, id, parsed.data, currentUserId);
    return jsonResponse(result, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "SELF_DEACTIVATION") {
      return errorResponse(
        400,
        "Bad Request",
        "Nie możesz deaktywować własnego konta."
      );
    }
    if (msg === "USER_NOT_FOUND") {
      return errorResponse(404, "Not Found", "Użytkownik o podanym ID nie istnieje.");
    }
    if (msg.includes("duplicate key") || msg.includes("unique")) {
      return errorResponse(409, "Conflict", "Email jest już zajęty przez innego użytkownika.");
    }
    logError("[PATCH /api/v1/admin/users/:id]", err);
    return errorResponse(
      500,
      "Internal Server Error",
      "Wystąpił błąd podczas aktualizacji użytkownika."
    );
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/v1/admin/users/:id — miękka deaktywacja
// ---------------------------------------------------------------------------

export const DELETE: APIRoute = async (context) => {
  const authResult = await requireAdmin(context);
  if (authResult instanceof Response) return authResult;

  const id = context.params.id;
  if (!id || !isValidUUID(id)) {
    return errorResponse(400, "Bad Request", "Nieprawidłowy identyfikator użytkownika.");
  }

  try {
    const supabase = createAdminSupabaseClient();
    const currentUserId = (authResult as { userId?: string; id?: string }).userId
      ?? (authResult as { userId?: string; id?: string }).id
      ?? "";
    await deactivateUser(supabase, id, currentUserId);
    // 204 No Content — brak body
    return new Response(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "SELF_DEACTIVATION") {
      return errorResponse(
        400,
        "Bad Request",
        "Nie możesz deaktywować własnego konta."
      );
    }
    if (msg === "USER_NOT_FOUND") {
      return errorResponse(404, "Not Found", "Użytkownik o podanym ID nie istnieje.");
    }
    logError("[DELETE /api/v1/admin/users/:id]", err);
    return errorResponse(
      500,
      "Internal Server Error",
      "Wystąpił błąd podczas deaktywacji użytkownika."
    );
  }
};
