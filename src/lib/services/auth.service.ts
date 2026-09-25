/**
 * Serwis autentykacji — sesja i profil użytkownika.
 * Używany przez endpoint GET /api/v1/auth/me oraz getAuthenticatedUser w api-helpers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types";
import type { AuthMeDto } from "@/types";

/** Mapowanie wiersza user_profiles (snake_case) na AuthMeDto (camelCase). */
function mapRowToAuthMeDto(
  row: Pick<
    Database["public"]["Tables"]["user_profiles"]["Row"],
    "id" | "email" | "full_name" | "phone" | "role" | "username" | "is_active"
  > & { location_id?: string | null }
): AuthMeDto {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role as AuthMeDto["role"],
    locationId: row.location_id ?? null,
    isActive: row.is_active,
  };
}

/**
 * Pobiera aktualnie zalogowanego użytkownika (sesja + profil z user_profiles).
 * Zgodnie z planem: sesja z supabase.auth.getUser(), potem profil z user_profiles po id.
 *
 * Zwraca null gdy:
 * - brak sesji lub błąd getUser(),
 * - brak rekordu w user_profiles (użytkownik w Auth bez profilu).
 * W obu przypadkach endpoint /auth/me zwróci 401.
 *
 * @param supabase — klient Supabase (z locals)
 * @returns AuthMeDto lub null
 */
export async function getCurrentUser(
  supabase: SupabaseClient<Database>
): Promise<AuthMeDto | null> {
  const {
    data: { user: authUser },
    error: sessionError,
  } = await supabase.auth.getUser();

  if (sessionError || !authUser) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id, email, username, full_name, phone, role, location_id, is_active")
    .eq("id", authUser.id)
    .maybeSingle();

  if (profileError || !profile) {
    return null;
  }

  // BLOKADA dezaktywowanych użytkowników:
  // is_active=false → user nie ma już dostępu, nawet jeśli JWT jest ważny.
  // Bez tego sprawdzenia user pozostawałby zalogowany do wygaśnięcia access_token (~1h)
  // mimo że admin go deaktywował (admin.signOut tylko revokuje refresh tokeny).
  if (profile.is_active === false) {
    return null;
  }

  return mapRowToAuthMeDto(profile);
}
