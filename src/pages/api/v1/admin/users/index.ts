/**
 * GET  /api/v1/admin/users — paginowana lista userów (panel admina).
 * POST /api/v1/admin/users — utworzenie usera + invite link.
 *
 * Autoryzacja: wymagana rola ADMIN.
 * Używa klienta service_role (auth.admin.* + pomijanie RLS).
 */

import type { APIRoute } from "astro";
import { z } from "zod";

import {
  errorResponse,
  jsonResponse,
  logError,
  parseJsonBody,
  parseQueryParams,
} from "../../../../../lib/api-helpers";
// requireAdmin z A3a-1 — guard na poziomie context.locals (sesja + rola ADMIN)
import { requireAdmin } from "../../../../../lib/auth/requireAdmin";
import {
  createAdminSupabaseClient,
  createUser,
  listUsers,
} from "../../../../../lib/services/user-admin.service";
import { createUserSchema } from "../../../../../lib/validators/auth.validator";

// ---------------------------------------------------------------------------
// Zod schema dla query params GET /admin/users
// ---------------------------------------------------------------------------

/**
 * Schema dla query — inline (typy DTO są w A1 domain, walidatory auth.validator.ts
 * nie zawierają query schemy; dla listy userów definiujemy lokalnie).
 */
const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  role: z.enum(["ADMIN", "PLANNER", "READ_ONLY"]).optional(),
  // Query stringi — "true"/"false" na boolean
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

// ---------------------------------------------------------------------------
// GET /api/v1/admin/users
// ---------------------------------------------------------------------------

export const GET: APIRoute = async (context) => {
  // Auth guard — sesja + rola ADMIN (rzuca 401/403 jako Response)
  const authResult = await requireAdmin(context);
  if (authResult instanceof Response) return authResult;

  // Walidacja query
  const url = new URL(context.request.url);
  const raw = parseQueryParams(url);
  const normalized: Record<string, string | undefined> = {};
  for (const key of Object.keys(raw)) {
    const v = raw[key];
    normalized[key] = Array.isArray(v) ? v[0] : v;
  }

  const parsed = userListQuerySchema.safeParse(normalized);
  if (!parsed.success) {
    const details: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!details[path]) details[path] = [];
      details[path].push(issue.message);
    }
    return errorResponse(400, "Bad Request", "Nieprawidłowe parametry zapytania.", details);
  }

  try {
    // service_role client — admin.auth.* oraz RLS bypass
    const supabase = createAdminSupabaseClient();
    const result = await listUsers(supabase, parsed.data);
    return jsonResponse(result, 200);
  } catch (err) {
    logError("[GET /api/v1/admin/users]", err);
    return errorResponse(
      500,
      "Internal Server Error",
      "Wystąpił błąd podczas pobierania listy userów."
    );
  }
};

// ---------------------------------------------------------------------------
// POST /api/v1/admin/users
// ---------------------------------------------------------------------------

export const POST: APIRoute = async (context) => {
  const authResult = await requireAdmin(context);
  if (authResult instanceof Response) return authResult;

  // Parse JSON body
  let body: unknown;
  try {
    body = await parseJsonBody<unknown>(context.request);
  } catch {
    return errorResponse(400, "Bad Request", "Nieprawidłowy lub pusty body JSON.");
  }

  const parsed = createUserSchema.safeParse(body);
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
    const result = await createUser(supabase, parsed.data);
    return jsonResponse(result, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    // 409 — duplikat username lub email (CITEXT UNIQUE constraint lub auth duplicate)
    if (
      msg.includes("duplicate key") ||
      msg.includes("already") ||
      msg.includes("registered") ||
      msg.includes("unique")
    ) {
      return errorResponse(
        409,
        "Conflict",
        "Użytkownik z takim username lub email już istnieje."
      );
    }
    logError("[POST /api/v1/admin/users]", err);
    return errorResponse(
      500,
      "Internal Server Error",
      "Wystąpił błąd podczas tworzenia użytkownika."
    );
  }
};
