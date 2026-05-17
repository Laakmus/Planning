/**
 * GET /api/v1/ms-oauth/start
 *
 * Inicjuje OAuth2 flow z Microsoft Graph:
 *   1. Weryfikuje sesję usera (każda rola — także READ_ONLY może podłączać własne konto MS).
 *   2. Generuje parę state + PKCE (`createOAuthState`).
 *   3. Buduje authorize URL.
 *   4. Redirectuje 302 do Microsoftu.
 *
 * Po zatwierdzeniu zgody przez usera Microsoft wraca do `GET /api/v1/ms-oauth/callback`.
 */

import type { APIRoute } from "astro";

import {
  errorResponse,
  getAuthenticatedUser,
  logError,
} from "../../../../lib/api-helpers";
import { createOAuthState } from "../../../../lib/oauth-state";
import { buildAuthorizationUrl } from "../../../../lib/services/ms-graph.service";

export const GET: APIRoute = async ({ locals }) => {
  const authResult = await getAuthenticatedUser(locals.supabase);
  if (authResult instanceof Response) return authResult;

  try {
    const { state, codeVerifier, codeChallenge } = createOAuthState(authResult.id);
    // codeVerifier jest przechowywany w mapie state — w buildAuthorizationUrl używamy tylko
    // codeChallenge (PKCE S256). Verifier zostanie odczytany w /callback.
    void codeVerifier;

    const authorizeUrl = buildAuthorizationUrl(state, codeChallenge, authResult.id);

    return new Response(null, {
      status: 302,
      headers: {
        Location: authorizeUrl,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    logError("[GET /api/v1/ms-oauth/start]", err);
    return errorResponse(
      500,
      "Internal Server Error",
      "Nie udało się rozpocząć procesu połączenia z kontem Microsoft."
    );
  }
};
