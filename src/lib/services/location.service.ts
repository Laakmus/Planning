/**
 * Serwis lokalizacji — zapytania wspólne dla endpointów magazynowych.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types";

/** Oddział wewnętrzny (lokalizacja firmy typu INTERNAL). */
export interface InternalLocation {
  id: string;
  name: string | null;
}

/**
 * Zwraca lokalizację, jeśli istnieje i należy do firmy wewnętrznej (INTERNAL).
 *
 * @returns lokalizacja lub `null`, gdy nie istnieje albo nie jest oddziałem wewnętrznym
 * @throws błąd PostgREST (np. brak połączenia z bazą)
 */
export async function findInternalLocation(
  supabase: SupabaseClient<Database>,
  locationId: string
): Promise<InternalLocation | null> {
  const { data, error } = await supabase
    .from("locations")
    .select("id, name, companies!inner(type)")
    .eq("id", locationId)
    .eq("companies.type", "INTERNAL")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { id: data.id, name: data.name ?? null };
}
