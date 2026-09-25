/**
 * Store parametrów OAuth state + PKCE code_verifier w tabeli `ms_oauth_states`.
 *
 * AUTH-MIG Faza B3 — Microsoft Graph OAuth2 Authorization Code + PKCE.
 *
 * Dlaczego DB (a nie Map w pamięci)?
 *   - Fly.io może uruchomić kilka maszyn lub zatrzymać maszynę (auto_stop) —
 *     /callback mógł trafić do procesu, który nie zna state,
 *   - jednorazowy odczyt (DELETE ... RETURNING) chroni przed replay-attack
 *     także przy równoległych callbackach.
 *
 * Wymaga klienta service_role — tabela ma RLS bez policies.
 */

import { createHash, randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types";

/** Maksymalny czas życia rekordu state (5 min). */
export const STATE_TTL_MS = 5 * 60 * 1000;

/** Koduje bufor do base64url (RFC 4648 §5) — wymagane przez PKCE. */
function base64url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Tworzy nową parę state + PKCE i zapisuje ją w DB.
 * Przy okazji usuwa wygasłe rekordy (porzucone przepływy /start bez /callback).
 *
 * @param admin — klient Supabase z service_role
 * @param userId — ID zalogowanego użytkownika Planning App
 */
export async function createOAuthState(
  admin: SupabaseClient<Database>,
  userId: string
): Promise<{ state: string; codeVerifier: string; codeChallenge: string }> {
  const state = randomBytes(32).toString("hex");
  const codeVerifier = base64url(randomBytes(64));
  const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());

  // Sprzątanie wygasłych — błąd nie blokuje nowego przepływu
  const cutoff = new Date(Date.now() - STATE_TTL_MS).toISOString();
  await admin.from("ms_oauth_states").delete().lt("created_at", cutoff);

  const { error } = await admin.from("ms_oauth_states").insert({
    state,
    user_id: userId,
    code_verifier: codeVerifier,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;

  return { state, codeVerifier, codeChallenge };
}

/**
 * Jednorazowo odczytuje i usuwa rekord state (atomowy DELETE ... RETURNING).
 *
 * @returns `{ userId, codeVerifier }` lub `null` gdy state nieznany, zużyty lub wygasły
 */
export async function consumeOAuthState(
  admin: SupabaseClient<Database>,
  state: string
): Promise<{ userId: string; codeVerifier: string } | null> {
  const { data, error } = await admin
    .from("ms_oauth_states")
    .delete()
    .eq("state", state)
    .select("user_id, code_verifier, created_at")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  if (Date.now() - new Date(data.created_at).getTime() > STATE_TTL_MS) {
    return null;
  }

  return { userId: data.user_id, codeVerifier: data.code_verifier };
}
