/**
 * Guard ADMIN dla endpointów Astro API.
 *
 * Założenia:
 *  - Middleware (`src/middleware.ts`) wstrzykuje `context.locals.supabase` z JWT usera.
 *  - Nie polegamy na `context.locals.user` — middleware go nie ustawia.
 *    Dlatego pobieramy aktualnego użytkownika przez `getCurrentUser()` z auth.service.
 *  - Guard zwraca union `{ userId, role: 'ADMIN' } | Response` — handler API sprawdza
 *    `instanceof Response` i krótko-zwraca odpowiedź błędu (401/403). Dzięki temu
 *    kontrakt jest spójny z istniejącymi guardami `getAuthenticatedUser`
 *    / `requireWriteAccess` w `api-helpers.ts` (zwracają Response|null/Response|dto).
 *
 * Różnica vs `requireAdmin` z `@/lib/api-helpers` (używany w cleanup.ts):
 *  - Tutaj: `(context)` — pobiera usera sam przez `getCurrentUser` (dla endpointów które
 *    nie wołały jeszcze `getAuthenticatedUser`).
 *  - Tam: `(user: AuthMeDto)` — wymaga wcześniejszego `getAuthenticatedUser`, zwraca
 *    `Response | null` (null = OK).
 */

import type { APIContext } from "astro";

import { errorResponse } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/services/auth.service";

export interface AdminContext {
  userId: string;
  role: "ADMIN";
}

/**
 * Weryfikuje, że żądanie pochodzi od zalogowanego użytkownika z rolą ADMIN.
 *
 * @returns `AdminContext` — dane admina dla happy-path
 * @returns `Response` (401/403) — gdy brak sesji lub rola nie jest ADMIN
 *
 * @example
 *   const authResult = await requireAdmin(context);
 *   if (authResult instanceof Response) return authResult;
 *   const { userId } = authResult;
 */
export async function requireAdmin(
  context: APIContext
): Promise<AdminContext | Response> {
  const supabase = context.locals.supabase;
  if (!supabase) {
    return errorResponse(
      500,
      "Internal Server Error",
      "Konfiguracja serwera: brak klienta Supabase."
    );
  }

  const user = await getCurrentUser(supabase);
  if (!user) {
    return errorResponse(
      401,
      "Unauthorized",
      "Brak sesji lub nieważny token. Zaloguj się ponownie."
    );
  }

  if (user.role !== "ADMIN") {
    return errorResponse(403, "Forbidden", "Brak uprawnień. Wymagana rola ADMIN.");
  }

  return { userId: user.id, role: "ADMIN" };
}
