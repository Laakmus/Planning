/**
 * Schematy Zod dla integracji Microsoft Graph (AUTH-MIG B3/B4):
 *   - walidacja query params dla GET /api/v1/ms-oauth/callback (Microsoft OAuth callback)
 *   - walidacja body POST /api/v1/orders/:id/prepare-email-graph
 *
 * Uwaga: schemat body dla `prepare-email-graph` jest minimalnym wariantem
 * (Graph nie potrzebuje `outputFormat` jak istniejący `prepareEmailSchema` z order.validator.ts),
 * ale współdzieli tę samą logikę budowania treści po stronie service.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/v1/ms-oauth/callback — query params
// ---------------------------------------------------------------------------
//
// Microsoft po authorize redirectuje do callback z jednym z dwóch wariantów:
//
//   SUCCESS: ?code=...&state=...&session_state=... (session_state opcjonalny)
//   ERROR:   ?error=...&error_description=...&state=...
//
// Discriminated union: dyskryminator istnienia `code` vs `error` realizujemy
// przez prefiltrowanie + union schema z odpowiednimi `.refine()` (Zod nie ma
// natywnego discriminatora po "obecności pola", więc używamy dwóch schematów +
// `union`).

/** Wariant sukcesu: Microsoft zwrócił `code` + `state`. */
export const oauthCallbackSuccessSchema = z.object({
  code: z.string().min(1, "code wymagany"),
  state: z.string().min(1, "state wymagany"),
  session_state: z.string().optional(),
});

/** Wariant błędu: Microsoft zwrócił `error` (np. user odrzucił consent). */
export const oauthCallbackErrorSchema = z.object({
  error: z.string().min(1),
  error_description: z.string().optional(),
  state: z.string().optional(),
});

/**
 * Pełny schemat callback — akceptuje sukces ALBO błąd.
 * Backend powinien rozróżnić warianty przez sprawdzenie `result.code` vs `result.error`.
 */
export const oauthCallbackQuerySchema = z.union([
  oauthCallbackSuccessSchema,
  oauthCallbackErrorSchema,
]);

export type OAuthCallbackSuccessParams = z.infer<typeof oauthCallbackSuccessSchema>;
export type OAuthCallbackErrorParams = z.infer<typeof oauthCallbackErrorSchema>;
export type OAuthCallbackQueryParams = z.infer<typeof oauthCallbackQuerySchema>;

// ---------------------------------------------------------------------------
// POST /api/v1/orders/:id/prepare-email-graph — body
// ---------------------------------------------------------------------------
//
// Graph-only flow: backend buduje content emaila (subject + body + PDF attachment)
// na podstawie zlecenia z DB, więc body żądania może być puste.
// Schemat tu istnieje jako placeholder na przyszłe opcje (np. wybór szablonu).

/** Body POST /api/v1/orders/:id/prepare-email-graph. */
export const prepareEmailGraphSchema = z
  .object({
    // Aktualnie brak opcji w body — Graph buduje wszystko z danych zlecenia.
    // Pozostawione jako pusty obiekt, by frontend mógł wysłać `POST` z `{}` lub bez body.
  })
  .strict()
  .optional()
  .default({});

export type PrepareEmailGraphParams = z.infer<typeof prepareEmailGraphSchema>;
