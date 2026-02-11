import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Browser-side Supabase client used by React islands.
 * Uses PUBLIC_ env variables that Astro exposes to client-side code.
 * Without these, logowanie w przeglądarce nie działa.
 */
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "[Supabase] Brak PUBLIC_SUPABASE_URL lub PUBLIC_SUPABASE_ANON_KEY w .env – logowanie nie zadziała. Zobacz .env.example."
  );
}

export const supabaseBrowser = createClient<Database>(supabaseUrl ?? "", supabaseAnonKey ?? "");
