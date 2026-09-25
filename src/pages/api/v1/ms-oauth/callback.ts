/**
 * GET /api/v1/ms-oauth/callback
 *
 * Microsoft redirectuje tu po authorize (success lub error).
 *
 * Przebieg sukcesu:
 *   1. Zod walidacja query (code+state lub error+state).
 *   2. `consumeOAuthState(state)` → odczytuje userId + codeVerifier (one-time).
 *   3. Exchange `code` → access_token + refresh_token (PKCE proof = codeVerifier).
 *   4. `getMsUser(accessToken)` → id + email z Graph /me.
 *   5. `saveTokens(serviceRole, userId, …)` → upsert do `ms_oauth_tokens`.
 *   6. Redirect 302 do `${PUBLIC_BASE_URL}/settings/email?ms_connected=1`.
 *
 * Przebieg błędu Microsoft (user odmówił consentu):
 *   - 400 z `error_description`.
 *
 * Przebieg state wygasły / nieznany:
 *   - 400 "Invalid or expired state".
 *
 * Uwaga: ten endpoint NIE wymaga JWT — Microsoft nie przesyła go w redirect.
 * Bezpieczeństwo zapewnia jednorazowy `state` + PKCE (atak CSRF nie może odgadnąć obu).
 */

import type { APIRoute } from "astro";

import {
  COMMON_HEADERS,
  errorResponse,
  logError,
  parseQueryParams,
} from "../../../../lib/api-helpers";
import { consumeOAuthState } from "../../../../lib/oauth-state";
import {
  exchangeCodeForTokens,
  getMsUser,
  saveTokens,
} from "../../../../lib/services/ms-graph.service";
import { oauthCallbackQuerySchema } from "../../../../lib/validators/ms-oauth.validator";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { getEnv } from "@/lib/env";

/** Buduje URL przekierowania po sukcesie / błędzie callbacku. */
function buildRedirectUrl(query: Record<string, string>): string {
  const base = getEnv("PUBLIC_BASE_URL") ?? "http://localhost:4321";
  const search = new URLSearchParams(query).toString();
  return `${base.replace(/\/+$/, "")}/settings/email?${search}`;
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const queryRaw = parseQueryParams(url);

  const parsed = oauthCallbackQuerySchema.safeParse(queryRaw);
  if (!parsed.success) {
    return errorResponse(
      400,
      "Bad Request",
      "Nieprawidłowe parametry callbacku Microsoft."
    );
  }

  // Wariant błędu: Microsoft zwrócił `error` (np. user kliknął "Anuluj")
  if ("error" in parsed.data) {
    const description = parsed.data.error_description || parsed.data.error;
    // Przekieruj z parametrem ms_error, aby frontend mógł pokazać banner
    const redirectUrl = buildRedirectUrl({
      ms_error: "1",
      ms_error_description: description.slice(0, 200),
    });
    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl, "Cache-Control": "no-store" },
    });
  }

  // Wariant sukcesu: weryfikujemy state + wymieniamy code na tokeny
  const { code, state } = parsed.data;
  let stateRecord: Awaited<ReturnType<typeof consumeOAuthState>>;
  try {
    stateRecord = await consumeOAuthState(createAdminSupabaseClient(), state);
  } catch (err) {
    logError("[GET /api/v1/ms-oauth/callback] consumeOAuthState", err);
    stateRecord = null;
  }
  if (!stateRecord) {
    return errorResponse(
      400,
      "Bad Request",
      "Sesja autoryzacji wygasła lub jest nieprawidłowa. Spróbuj ponownie.",
      undefined
    );
  }

  try {
    // 1. Exchange code → tokens (PKCE proof = codeVerifier)
    const tokenResponse = await exchangeCodeForTokens(code, stateRecord.codeVerifier);

    // 2. Profil z Graph /me
    const msUser = await getMsUser(tokenResponse.access_token);

    // 3. Zapis do DB (service_role omija RLS)
    await saveTokens(createAdminSupabaseClient(), stateRecord.userId, tokenResponse, msUser);

    // 4. Redirect na settings/email z flagą sukcesu
    const redirectUrl = buildRedirectUrl({ ms_connected: "1" });
    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl, "Cache-Control": "no-store" },
    });
  } catch (err) {
    logError("[GET /api/v1/ms-oauth/callback]", err);
    // Nie ujawniamy szczegółów Microsoftu — generyczny komunikat
    const redirectUrl = buildRedirectUrl({
      ms_error: "1",
      ms_error_description: "Połączenie z kontem Microsoft nie powiodło się. Spróbuj ponownie.",
    });
    // Świadomie zostawiamy COMMON_HEADERS w przypadku redirect (cache-control)
    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl,
        "Cache-Control": COMMON_HEADERS["Cache-Control"],
      },
    });
  }
};
