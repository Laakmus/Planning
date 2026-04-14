/**
 * POST /api/v1/auth/login
 *
 * Logowanie przez username + hasło (zastępuje email-based login).
 *
 * Przebieg:
 *   1. Rate limit po IP (10 prób / 15 min).
 *   2. Zod walidacja body.
 *   3. RPC `resolve_username_to_email` (service_role) → email + is_active.
 *   4. Jeżeli konto nieaktywne → 403.
 *   5. `supabase.auth.signInWithPassword({ email, password })` — anonimowy klient.
 *   6. Odczyt profilu z `user_profiles` (service_role) → zbudowanie odpowiedzi.
 *
 * Komunikaty 401 świadomie NIE zdradzają, czy problem dotyczy usera czy hasła
 * (ochrona przed user enumeration).
 */

import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { ZodError } from "zod";

import type { Database } from "@/db/database.types";
import type { UsernameLoginResponse } from "@/types/auth.types";
import { errorResponse, jsonResponse, logError, parseJsonBody } from "@/lib/api-helpers";
import { checkLoginRateLimit } from "@/lib/auth/rate-limit";
import { loginUsernameSchema } from "@/lib/validators/auth.validator";

/** Odczyt zmiennej środowiskowej z fallbackiem na `process.env`. */
function getEnv(key: string): string {
  return import.meta.env[key] ?? process.env[key] ?? "";
}

/** Klient Supabase z service_role — omija RLS, używany do RPC i odczytu user_profiles. */
function createAdminClient() {
  const url = getEnv("SUPABASE_URL");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Klient Supabase z anon key — używany do `signInWithPassword` (logowanie anonimowe). */
function createAnonClient() {
  const url = getEnv("SUPABASE_URL");
  const anonKey = getEnv("SUPABASE_ANON_KEY");
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Ekstrakcja IP klienta — preferujemy `x-forwarded-for`, fallback na `clientAddress`. */
function extractClientIp(request: Request, clientAddress: string | undefined): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // `x-forwarded-for` może zawierać listę: "client, proxy1, proxy2"
    return forwarded.split(",")[0].trim();
  }
  return clientAddress ?? "unknown";
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // 1. Rate limit po IP
  const ip = extractClientIp(request, clientAddress);
  const rate = checkLoginRateLimit(ip);
  if (!rate.allowed) {
    return new Response(
      JSON.stringify({
        error: "Too Many Requests",
        message: "Zbyt wiele prób logowania. Spróbuj ponownie za chwilę.",
        statusCode: 429,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rate.retryAfterSec ?? 60),
        },
      }
    );
  }

  // 2. Walidacja body
  let input: { username: string; password: string };
  try {
    const raw = await parseJsonBody<unknown>(request);
    input = loginUsernameSchema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      const details: Record<string, string[]> = {};
      for (const issue of err.issues) {
        const key = issue.path.join(".") || "_";
        (details[key] ??= []).push(issue.message);
      }
      return errorResponse(400, "Bad Request", "Nieprawidłowe dane logowania.", details);
    }
    if (err instanceof SyntaxError) {
      return errorResponse(400, "Bad Request", "Nieprawidłowy JSON w body żądania.");
    }
    logError("[POST /api/v1/auth/login:parseBody]", err);
    return errorResponse(500, "Internal Server Error", "Wewnętrzny błąd serwera.");
  }

  try {
    const admin = createAdminClient();

    // 3. Resolve username → email + is_active (RPC SECURITY DEFINER)
    const { data: rpcRows, error: rpcError } = await admin.rpc(
      "resolve_username_to_email",
      { p_username: input.username }
    );

    if (rpcError) {
      logError("[POST /api/v1/auth/login:rpc]", rpcError);
      return errorResponse(500, "Internal Server Error", "Wewnętrzny błąd serwera.");
    }

    const row = Array.isArray(rpcRows) && rpcRows.length > 0 ? rpcRows[0] : null;
    if (!row) {
      // Nie zdradzamy, czy user nie istnieje — 401 jak przy błędnym haśle.
      return errorResponse(401, "Unauthorized", "Nieprawidłowy login lub hasło.");
    }

    // 4. Logowanie przez GoTrue (klient anonimowy — signInWithPassword nie wymaga RLS).
    //    Kolejność (anti-enumeration): NAJPIERW weryfikujemy hasło, DOPIERO POTEM is_active.
    //    Dzięki temu atakujący bez znajomości hasła nie dowie się, czy username istnieje
    //    (istniejący-zły-hasło i nieistniejący dostają ten sam 401).
    const anon = createAnonClient();
    const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
      email: row.email,
      password: input.password,
    });

    if (signInError || !signInData.session || !signInData.user) {
      // Świadomie identyczny komunikat jak dla nieznanego username.
      return errorResponse(401, "Unauthorized", "Nieprawidłowy login lub hasło.");
    }

    // Hasło OK — dopiero teraz sprawdzamy czy konto jest aktywne.
    // 403 ujawnia istnienie usera, ale wymaga poprawnego hasła (akceptowalny trade-off).
    if (!row.is_active) {
      return errorResponse(
        403,
        "Forbidden",
        "Konto nieaktywne. Skontaktuj się z administratorem."
      );
    }

    // 5. Pobierz profil do odpowiedzi (service_role, omija RLS).
    const { data: profile, error: profileError } = await admin
      .from("user_profiles")
      .select("id, username, email, full_name, role, is_active")
      .eq("id", signInData.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      logError("[POST /api/v1/auth/login:profile]", profileError ?? "profile not found");
      return errorResponse(500, "Internal Server Error", "Wewnętrzny błąd serwera.");
    }

    const response: UsernameLoginResponse = {
      accessToken: signInData.session.access_token,
      refreshToken: signInData.session.refresh_token,
      user: {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        fullName: profile.full_name,
        role: profile.role as UsernameLoginResponse["user"]["role"],
        isActive: profile.is_active,
      },
    };

    return jsonResponse(response, 200);
  } catch (err) {
    logError("[POST /api/v1/auth/login]", err);
    return errorResponse(500, "Internal Server Error", "Wewnętrzny błąd serwera.");
  }
};
