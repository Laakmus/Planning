/**
 * Guard ADMIN dla endpointów Astro API.
 *
 * Założenia:
 *  - Middleware (`src/middleware.ts`) wstrzykuje `context.locals.supabase` z JWT usera.
 *  - Nie polegamy na `context.locals.user` — middleware go nie ustawia.
 *    Dlatego pobieramy aktualnego użytkownika przez `getCurrentUser()` z auth.service.
 *  - Guard rzuca `AuthGuardError` z kodem HTTP — handler API łapie i konwertuje na Response.
 *    Dzięki temu kontrakt jest zgodny z `Promise<{ userId, role: 'ADMIN' }>` bez mieszania się
 *    z typem `Response` w ścieżce happy-path.
 */

import type { APIContext } from "astro";

import { getCurrentUser } from "@/lib/services/auth.service";

/** Rzucany, gdy guard odrzuca żądanie. Handler API mapuje go na `errorResponse(...)`. */
export class AuthGuardError extends Error {
  constructor(
    public readonly statusCode: 401 | 403,
    public readonly errorCode: "Unauthorized" | "Forbidden",
    message: string
  ) {
    super(message);
    this.name = "AuthGuardError";
  }
}

/**
 * Weryfikuje, że żądanie pochodzi od zalogowanego użytkownika z rolą ADMIN.
 *
 * @throws {AuthGuardError} 401 — brak sesji / nieważny token
 * @throws {AuthGuardError} 403 — rola inna niż ADMIN
 * @returns `{ userId, role: 'ADMIN' }` dla happy-path
 */
export async function requireAdmin(
  context: APIContext
): Promise<{ userId: string; role: "ADMIN" }> {
  const supabase = context.locals.supabase;
  if (!supabase) {
    throw new AuthGuardError(
      401,
      "Unauthorized",
      "Brak klienta Supabase w kontekście. Sprawdź middleware."
    );
  }

  const user = await getCurrentUser(supabase);
  if (!user) {
    throw new AuthGuardError(
      401,
      "Unauthorized",
      "Brak sesji lub nieważny token. Zaloguj się ponownie."
    );
  }

  if (user.role !== "ADMIN") {
    throw new AuthGuardError(
      403,
      "Forbidden",
      "Brak uprawnień. Wymagana rola ADMIN."
    );
  }

  return { userId: user.id, role: "ADMIN" };
}

/**
 * Alias dla `requireAdmin` — wygodny składniowo w handlerach,
 * gdzie zwracana wartość nie jest używana (`await assertAdmin(context);`).
 */
export const assertAdmin = requireAdmin;
