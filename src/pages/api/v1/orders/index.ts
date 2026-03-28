/**
 * GET /api/v1/orders — lista zleceń z paginacją, filtrami i sortowaniem.
 * POST /api/v1/orders — tworzenie zlecenia (status robocze).
 *
 * Odpowiedź GET: 200 + OrderListResponseDto. Błędy: 400, 401.
 * Odpowiedź POST: 201 + CreateOrderResponseDto. Błędy: 400, 401, 403, 409.
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  parseJsonBody,
  parseQueryParams,
  requireWriteAccess,
  logError,
} from "../../../../lib/api-helpers";
import { createOrder, listOrders } from "../../../../lib/services/order.service";
import { createOrderSchema, orderListQuerySchema } from "../../../../lib/validators/order.validator";

/** Dla parametrów query: jeśli wartość to tablica, dla pojedynczych pól bierzemy pierwszą. */
function normalizeQuery(
  raw: Record<string, string | string[]>
): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = {};
  for (const key of Object.keys(raw)) {
    const v = raw[key];
    if (v === undefined) continue;
    out[key] = Array.isArray(v) ? (key === "status" ? v : v[0]) : v;
  }
  return out;
}

export const GET: APIRoute = async ({ locals, request }) => {
  if (!locals.supabase) {
    return errorResponse(
      500,
      "Internal Server Error",
      "Konfiguracja serwera: brak klienta Supabase."
    );
  }

  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) {
    return authResult;
  }

  const url = new URL(request.url);
  const raw = parseQueryParams(url);
  const normalized = normalizeQuery(raw);

  const parsed = orderListQuerySchema.safeParse(normalized);
  if (!parsed.success) {
    const details: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!details[path]) details[path] = [];
      details[path].push(issue.message);
    }
    return errorResponse(
      400,
      "Bad Request",
      "Nieprawidłowe parametry zapytania.",
      details
    );
  }

  try {
    const result = await listOrders(locals.supabase, parsed.data);
    return jsonResponse(result, 200);
  } catch (err) {
    logError("[GET /api/v1/orders]", err);
    return errorResponse(
      500,
      "Internal Server Error",
      "Wystąpił błąd podczas pobierania listy zleceń."
    );
  }
};

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

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    const details: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!details[path]) details[path] = [];
      details[path].push(issue.message);
    }
    return errorResponse(400, "Bad Request", "Nieprawidłowe dane zlecenia.", details);
  }

  try {
    const result = await createOrder(locals.supabase, authResult.id, parsed.data);
    return jsonResponse(result, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "FK_VALIDATION") {
      const details = (err as Error & { details?: Record<string, string> }).details ?? {};
      return errorResponse(400, "Bad Request", "Nieprawidłowe referencje w danych zlecenia.", details);
    }
    if (msg === "STOPS_LIMIT") {
      return errorResponse(400, "Bad Request", "Przekroczono limit punktów trasy (max 8 załadunków, 3 rozładunków).");
    }
    if (msg === "STOPS_ORDER") {
      return errorResponse(400, "Bad Request", "Pierwszy punkt trasy musi być załadunkiem, ostatni rozładunkiem.");
    }
    logError("[POST /api/v1/orders]", err);
    return errorResponse(
      500,
      "Internal Server Error",
      "Wystąpił błąd podczas tworzenia zlecenia."
    );
  }
};
