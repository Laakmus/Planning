/**
 * Helpery dla endpointów REST API (api/v1):
 * - auth guard (getAuthenticatedUser, requireWriteAccess, requireAdmin)
 * - odpowiedzi JSON i błędy
 * - parsowanie query/body i walidacja UUID
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../db/database.types";
import type { AuthMeDto } from "../types";
import { getCurrentUser } from "./services/auth.service";

/** Regex dla formatu UUID (8-4-4-4-12 hex). */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Security + CORS headers dołączane do każdej odpowiedzi API. */
const COMMON_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Access-Control-Allow-Origin": import.meta.env.CORS_ORIGIN ?? "http://localhost:4321",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key",
};

/**
 * Pobiera i weryfikuje zalogowanego użytkownika (Supabase Auth + user_profiles).
 * Zwraca AuthMeDto lub Response z kodem 401 do natychmiastowego zwrócenia z handlera.
 *
 * @param supabase — klient Supabase z context.locals
 * @returns AuthMeDto lub Response (401)
 */
export async function getAuthenticatedUser(
  supabase: SupabaseClient<Database>
): Promise<AuthMeDto | Response> {
  const user = await getCurrentUser(supabase);
  if (!user) {
    return errorResponse(
      401,
      "Unauthorized",
      "Brak sesji lub nieważny token. Zaloguj się ponownie."
    );
  }
  return user;
}

/**
 * Sprawdza, czy użytkownik ma rolę ADMIN lub PLANNER (uprawnienia do zapisu).
 * Zwraca Response z kodem 403 do zwrócenia z handlera lub null, gdy uprawnienia OK.
 *
 * @param user — profil użytkownika z getAuthenticatedUser
 * @returns Response (403) lub null
 */
export function requireWriteAccess(user: AuthMeDto): Response | null {
  if (user.role !== "ADMIN" && user.role !== "PLANNER") {
    return errorResponse(
      403,
      "Forbidden",
      "Brak uprawnień do tej operacji. Wymagana rola ADMIN lub PLANNER."
    );
  }
  return null;
}

/**
 * Sprawdza, czy użytkownik ma rolę ADMIN.
 * Zwraca Response z kodem 403 do zwrócenia z handlera lub null, gdy OK.
 *
 * @param user — profil użytkownika z getAuthenticatedUser
 * @returns Response (403) lub null
 */
export function requireAdmin(user: AuthMeDto): Response | null {
  if (user.role !== "ADMIN") {
    return errorResponse(
      403,
      "Forbidden",
      "Brak uprawnień. Wymagana rola ADMIN."
    );
  }
  return null;
}

/**
 * Zwraca odpowiedź JSON z opcjonalnym kodem statusu.
 *
 * @param data — body odpowiedzi (będzie zserializowane przez JSON.stringify)
 * @param status — domyślnie 200
 */
export function jsonResponse(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...COMMON_HEADERS, ...extraHeaders },
  });
}

/**
 * Zwraca odpowiedź błędu w formacie JSON (zgodnie z konwencją API).
 *
 * @param statusCode — kod HTTP (400, 401, 403, 404, 409, 410, 422, 500)
 * @param error — krótki identyfikator błędu (np. "Unauthorized")
 * @param message — czytelny komunikat dla użytkownika
 * @param details — opcjonalne szczegóły walidacji (np. pole -> lista błędów)
 */
export function errorResponse(
  statusCode: number,
  error: string,
  message: string,
  details?: Record<string, string | string[]>
): Response {
  const body: Record<string, unknown> = {
    error,
    message,
    statusCode,
  };
  if (details && Object.keys(details).length > 0) {
    body.details = details;
  }
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: COMMON_HEADERS,
  });
}

/**
 * Parsuje parametry zapytania z URL.
 * Wartości występujące wielokrotnie zwracane jako string[].
 *
 * @param url — obiekt URL z request.url
 * @returns obiekt klucz -> wartość lub tablica wartości
 */
export function parseQueryParams(url: URL): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  url.searchParams.forEach((value, key) => {
    const existing = result[key];
    if (existing === undefined) {
      result[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      result[key] = [existing, value];
    }
  });
  return result;
}

/**
 * Parsuje body żądania jako JSON.
 * Rzuca błąd przy nieprawidłowym JSON (obsłuż w handlerze i zwróć 400).
 *
 * @param request — obiekt Request
 * @returns zparsowany obiekt (bez walidacji typów — do walidacji Zod)
 */
export async function parseJsonBody<T>(request: Request): Promise<T> {
  const text = await request.text();
  if (!text.trim()) {
    throw new SyntaxError("Empty body");
  }
  return JSON.parse(text) as T;
}

/**
 * Sprawdza, czy string jest poprawnym UUID (format v4).
 *
 * @param value — ciąg do sprawdzenia
 * @returns true, gdy format jest prawidłowy
 */
export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}
