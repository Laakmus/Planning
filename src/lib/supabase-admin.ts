/**
 * Fabryki klientów Supabase po stronie serwera (bez sesji użytkownika).
 *
 * - `createAdminSupabaseClient` — klucz service_role (omija RLS). Tylko backend!
 * - `tryCreateAdminSupabaseClient` — j.w., ale zwraca `null` przy braku konfiguracji
 *   (operacje nie-krytyczne: presence, logout).
 * - `createAnonSupabaseClient` — klucz anon, np. do `signInWithPassword`.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types";
import { getEnv } from "@/lib/env";

const SERVER_AUTH_OPTIONS = {
  auth: { persistSession: false, autoRefreshToken: false },
} as const;

/** Klient service_role lub `null`, gdy brak SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. */
export function tryCreateAdminSupabaseClient(): SupabaseClient<Database> | null {
  const url = getEnv("SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return null;
  return createClient<Database>(url, serviceRoleKey, SERVER_AUTH_OPTIONS);
}

/** Klient service_role. Rzuca, gdy brak konfiguracji. */
export function createAdminSupabaseClient(): SupabaseClient<Database> {
  const client = tryCreateAdminSupabaseClient();
  if (!client) {
    throw new Error(
      "Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY — nie można utworzyć klienta admin."
    );
  }
  return client;
}

/** Klient z kluczem anon (bez sesji). Rzuca, gdy brak konfiguracji. */
export function createAnonSupabaseClient(): SupabaseClient<Database> {
  const url = getEnv("SUPABASE_URL");
  const anonKey = getEnv("SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    throw new Error("Brak SUPABASE_URL lub SUPABASE_ANON_KEY — nie można utworzyć klienta anon.");
  }
  return createClient<Database>(url, anonKey, SERVER_AUTH_OPTIONS);
}
