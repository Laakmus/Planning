/**
 * POST /api/v1/auth/activate
 *
 * Aktywacja konta przez invite token z linka wygenerowanego w panelu admina.
 *
 * Przebieg:
 *   1. Zod walidacja body `{ token }`.
 *   2. SHA-256 z plaintext tokenu.
 *   3. Lookup `user_profiles` po `invite_token_hash` (service_role, omija RLS).
 *   4. Walidacja: token istnieje, nie wygasł, konto nieaktywne.
 *   5. UPDATE: `is_active=true, activated_at=now(), invite_token_hash=null, invite_expires_at=null`.
 *
 * Endpoint świadomie NIE ujawnia innych szczegółów (ID, email) — tylko status operacji.
 */

import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { ZodError } from "zod";

import type { Database } from "@/db/database.types";
import type { ActivateAccountResponse } from "@/types/auth.types";
import { errorResponse, jsonResponse, logError, parseJsonBody } from "@/lib/api-helpers";
import { checkActivateRateLimit } from "@/lib/auth/rate-limit";
import { hashInviteToken } from "@/lib/services/invite-token.service";
import { activateAccountSchema } from "@/lib/validators/auth.validator";

/** Pobiera IP klienta z nagłówków (z fallbackiem). */
function getClientIp(request: Request, clientAddress: string | undefined): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return clientAddress ?? "unknown";
}

/** Odczyt zmiennej środowiskowej z fallbackiem na `process.env`. */
function getEnv(key: string): string {
  return import.meta.env[key] ?? process.env[key] ?? "";
}

/** Klient Supabase z service_role — omija RLS, potrzebne do UPDATE user_profiles. */
function createAdminClient() {
  const url = getEnv("SUPABASE_URL");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // 0. Rate-limit per IP (defense-in-depth — token 32B SHA-256 jest bezpieczny,
  //    ale limit chroni przed enumeration/DoS).
  const ip = getClientIp(request, clientAddress);
  const rl = checkActivateRateLimit(ip);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({
        error: "Too Many Requests",
        message: "Zbyt wiele prób aktywacji. Spróbuj ponownie później.",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rl.retryAfterSec ?? 60),
        },
      }
    );
  }

  // 1. Walidacja body
  let input: { token: string };
  try {
    const raw = await parseJsonBody<unknown>(request);
    input = activateAccountSchema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      const details: Record<string, string[]> = {};
      for (const issue of err.issues) {
        const key = issue.path.join(".") || "_";
        (details[key] ??= []).push(issue.message);
      }
      return errorResponse(400, "Bad Request", "Nieprawidłowy token aktywacyjny.", details);
    }
    if (err instanceof SyntaxError) {
      return errorResponse(400, "Bad Request", "Nieprawidłowy JSON w body żądania.");
    }
    logError("[POST /api/v1/auth/activate:parseBody]", err);
    return errorResponse(500, "Internal Server Error", "Wewnętrzny błąd serwera.");
  }

  try {
    const admin = createAdminClient();
    const hash = hashInviteToken(input.token);

    // 2. Lookup po hashu
    const { data: profile, error: selectError } = await admin
      .from("user_profiles")
      .select("id, invite_expires_at, is_active")
      .eq("invite_token_hash", hash)
      .limit(1)
      .maybeSingle();

    if (selectError) {
      logError("[POST /api/v1/auth/activate:select]", selectError);
      return errorResponse(500, "Internal Server Error", "Wewnętrzny błąd serwera.");
    }

    if (!profile) {
      return errorResponse(
        400,
        "Bad Request",
        "Nieprawidłowy lub wygasły link aktywacyjny."
      );
    }

    // 3. Sprawdzenie wygaśnięcia
    const expiresAt = profile.invite_expires_at ? new Date(profile.invite_expires_at) : null;
    if (!expiresAt || expiresAt.getTime() < Date.now()) {
      return errorResponse(
        400,
        "Bad Request",
        "Link wygasł. Poproś administratora o nowy."
      );
    }

    // 4. Idempotencja — konto już aktywne
    if (profile.is_active) {
      return errorResponse(
        400,
        "Bad Request",
        "Konto już aktywne. Zaloguj się."
      );
    }

    // 5. Aktywacja — czyścimy token, żeby nie dało się użyć go ponownie.
    //    TOCTOU guard: `.eq("is_active", false)` — jeśli inny concurrent request już
    //    aktywował konto, nasz UPDATE trafi 0 rekordów (idempotentnie bezpieczne).
    const { error: updateError } = await admin
      .from("user_profiles")
      .update({
        is_active: true,
        activated_at: new Date().toISOString(),
        invite_token_hash: null,
        invite_expires_at: null,
      })
      .eq("id", profile.id)
      .eq("is_active", false);

    if (updateError) {
      logError("[POST /api/v1/auth/activate:update]", updateError);
      return errorResponse(500, "Internal Server Error", "Wewnętrzny błąd serwera.");
    }

    const response: ActivateAccountResponse = { ok: true };
    return jsonResponse(response, 200);
  } catch (err) {
    logError("[POST /api/v1/auth/activate]", err);
    return errorResponse(500, "Internal Server Error", "Wewnętrzny błąd serwera.");
  }
};
